import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/prismadb";
import { Prisma } from "@prisma/client";
import type {
  Asset,
  Conversation,
  Generation,
  GenerationStatus,
  LibraryItem,
  Page,
  Tool,
} from "@/lib/types";
import { AppError } from "./errors";
import { dailyLimit } from "./config";

const json = <T>(v: unknown): T => JSON.parse(JSON.stringify(v)) as T;
const notFound = () =>
  new AppError(404, "NOT_FOUND", "This item could not be found.");
const active = ["queued", "running"];
export interface ReserveInput {
  tool: Tool;
  prompt: string;
  conversationId?: string;
  idempotencyKey: string;
  size?: string;
}
function fingerprint(input: ReserveInput) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.tool,
        input.prompt,
        input.conversationId ?? null,
        input.size ?? null,
      ]),
    )
    .digest("hex");
}
function checkBudget(
  count: number,
  recent: number,
  running: number,
  limit: number,
) {
  if (running)
    throw new AppError(
      409,
      "BUSY",
      "A generation is already active. Wait for it to finish or stop it first.",
    );
  if (count >= limit)
    throw new AppError(
      429,
      "DAILY_LIMIT",
      "Your daily request limit has been reached. It resets at midnight UTC.",
    );
  if (recent >= 5)
    throw new AppError(
      429,
      "RATE_LIMIT",
      "Please wait a minute before generating again.",
    );
}
function duplicate(g: Generation, hash: string) {
  if (g.fingerprint !== hash)
    throw new AppError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "This request key was already used with different input.",
    );
  return { generation: g, reused: true };
}
export async function reserve(
  ownerId: string,
  input: ReserveInput,
): Promise<{ generation: Generation; reused: boolean }> {
  const hash = fingerprint(input);
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);

  // A per-owner row lock serializes BOTH quota checks and reservations across instances.
  try {
    await db.owner.create({ data: { id: ownerId } });
  } catch (error) {
    if (!(
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ))
      throw error;
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM Owner WHERE id = ${ownerId} FOR UPDATE`;
      const existing = await tx.generation.findUnique({
        where: {
          ownerId_idempotencyKey: {
            ownerId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { assets: true },
      });
      if (existing) return duplicate(json<Generation>(existing), hash);
      if (input.conversationId) {
        const c = await tx.conversation.findFirst({
          where: { id: input.conversationId, ownerId, tool: input.tool },
        });
        if (!c) throw notFound();
      }
      const count = await tx.usageRecord.count({
        where: { ownerId, createdAt: { gte: midnight } },
      });
      const recent = await tx.usageRecord.count({
        where: { ownerId, createdAt: { gt: new Date(Date.now() - 60000) } },
      });
      const running = await tx.generation.count({
        where: { ownerId, status: { in: active } },
      });
      checkBudget(count, recent, running, dailyLimit());
      let conversationId = input.conversationId;
      if (!conversationId && (input.tool === "chat" || input.tool === "code"))
        conversationId = (
          await tx.conversation.create({
            data: {
              ownerId,
              tool: input.tool,
              title: input.prompt.slice(0, 100),
            },
          })
        ).id;
      const generation = await tx.generation.create({
        data: {
          ownerId,
          conversationId,
          tool: input.tool,
          title: input.prompt.slice(0, 100),
          prompt: input.prompt,
          status: "queued",
          idempotencyKey: input.idempotencyKey,
          fingerprint: hash,
          options: input.size ? { size: input.size } : {},
          usage: { create: { ownerId, tool: input.tool } },
        },
        include: { assets: true },
      });
      if (conversationId) {
        await tx.message.create({
          data: {
            conversationId,
            generationId: generation.id,
            role: "user",
            content: input.prompt,
            status: "completed",
          },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      }
      return { generation: json<Generation>(generation), reused: false };
    },
    { isolationLevel: "ReadCommitted", timeout: 10000 },
  );
}
export async function getConversation(ownerId: string, id: string) {
  // Read messages and job state from the same snapshot so a final checkpoint
  // cannot be missed when the client decides whether to keep polling.
  const [c] = await db.$transaction(
    [
      db.conversation.findFirst({
        where: { ownerId, id },
        include: {
          messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          generations: {
            where: { status: { in: active } },
            select: { id: true, status: true },
            take: 1,
          },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  if (!c) throw notFound();
  const { generations, ...conversation } = c;
  return json<Conversation>({
    ...conversation,
    activeGeneration: generations[0] ?? null,
  });
}
export async function getGeneration(ownerId: string, id: string) {
  const g = await db.generation.findFirst({
    where: { ownerId, id },
    include: { assets: true },
  });
  if (!g) throw notFound();
  return json<Generation>(g);
}
export async function claim(id: string) {
  return (
    (
      await db.generation.updateMany({
        where: { id, status: "queued" },
        data: { status: "running" },
      })
    ).count === 1
  );
}
export async function setProvider(id: string, providerId: string) {
  await db.generation.update({ where: { id }, data: { providerId } });
}
export async function saveAssistant(
  g: Generation,
  content: string,
  status: GenerationStatus,
) {
  const conversationId = g.conversationId;
  if (!conversationId) return;

  await db.$transaction(async (tx) => {
    // Serialize checkpoints with finalization; late workers cannot restore
    // a running message after its generation has reached a terminal state.
    const claimed = await tx.generation.updateMany({
      where: { id: g.id, status: { in: active } },
      data: { updatedAt: new Date() },
    });
    if (!claimed.count) return;
    await tx.message.upsert({
      where: { generationId_role: { generationId: g.id, role: "assistant" } },
      create: {
        conversationId,
        generationId: g.id,
        role: "assistant",
        content,
        status,
      },
      update: { content, status },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  });
}
export async function finish(
  id: string,
  status: GenerationStatus,
  error: string | null = null,
  tokens = { inputTokens: 0, outputTokens: 0 },
  content?: string,
) {
  await db.$transaction(async (tx) => {
    const result = await tx.generation.updateMany({
      where: { id, status: { in: active } },
      data: { status, error, ...tokens },
    });
    if (result.count) {
      const generation = await tx.generation.findUniqueOrThrow({
        where: { id },
      });
      if (generation.conversationId) {
        await tx.message.upsert({
          where: { generationId_role: { generationId: id, role: "assistant" } },
          create: {
            conversationId: generation.conversationId,
            generationId: id,
            role: "assistant",
            content: content ?? "",
            status,
          },
          update: { status, ...(content === undefined ? {} : { content }) },
        });
        await tx.conversation.update({
          where: { id: generation.conversationId },
          data: { updatedAt: new Date() },
        });
      }
      await tx.usageRecord.updateMany({
        where: { generationId: id },
        data: tokens,
      });
    }
  });
}
export async function addAsset(
  g: Generation,
  data: Omit<Asset, "id" | "ownerId" | "generationId">,
) {
  return db.asset.create({
    data: { ...data, ownerId: g.ownerId, generationId: g.id },
  });
}
export async function getAsset(ownerId: string, id: string) {
  const a = await db.asset.findFirst({ where: { id, ownerId } });
  if (!a) throw notFound();
  return a;
}
export interface LibraryQuery {
  q: string;
  page: number;
  tool: "all" | Tool;
  favorite: string;
}
export async function library(
  ownerId: string,
  query: LibraryQuery,
): Promise<Page<LibraryItem>> {
  const { q, page, tool, favorite } = query;
  const take = 18,
    skip = (page - 1) * take;
  const mapC = (c: Conversation): LibraryItem => ({
    id: c.id,
    kind: "conversation",
    title: c.title,
    tool: c.tool,
    favorite: c.favorite,
    updatedAt: c.updatedAt,
  });
  const mapG = (g: Generation): LibraryItem => ({
    id: g.id,
    kind: "generation",
    title: g.title,
    tool: g.tool,
    favorite: g.favorite,
    updatedAt: g.updatedAt,
    status: g.status,
    assets: g.assets,
    prompt: g.prompt,
  });

  const base = {
    ownerId,
    ...(tool !== "all" ? { tool } : {}),
    ...(favorite === "true" ? { favorite: true } : {}),
  };
  const cw: Prisma.ConversationWhereInput = {
    ...base,
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { messages: { some: { content: { contains: q } } } },
          ],
        }
      : {}),
  };
  const gw: Prisma.GenerationWhereInput = {
    ...base,
    conversationId: null,
    ...(q
      ? { OR: [{ title: { contains: q } }, { prompt: { contains: q } }] }
      : {}),
  };
  // Fetch at most the requested prefix from each independently indexed collection, then merge.
  const [cs, gs, cc, gc] = await Promise.all([
    db.conversation.findMany({
      where: cw,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: skip + take,
    }),
    db.generation.findMany({
      where: gw,
      include: { assets: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: skip + take,
    }),
    db.conversation.count({ where: cw }),
    db.generation.count({ where: gw }),
  ]);
  const items = [
    ...json<Conversation[]>(cs).map(mapC),
    ...json<Generation[]>(gs).map(mapG),
  ]
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
    )
    .slice(skip, skip + take);
  return { items, total: cc + gc, page, hasMore: cc + gc > skip + take };
}
export async function patchItem(
  ownerId: string,
  id: string,
  kind: string,
  data: { title?: string; favorite?: boolean },
) {
  const result =
    kind === "conversation"
      ? await db.conversation.updateMany({ where: { id, ownerId }, data })
      : await db.generation.updateMany({ where: { id, ownerId }, data });
  if (!result.count) throw notFound();
}
export async function deleteItem(ownerId: string, id: string, kind: string) {
  // Use the same owner lock as reservation: deletion must not race a new turn.
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM Owner WHERE id = ${ownerId} FOR UPDATE`;
      if (kind === "conversation") {
        if (!(await tx.conversation.findFirst({ where: { id, ownerId } })))
          throw notFound();
      }
      const generations = await tx.generation.findMany({
        where:
          kind === "conversation"
            ? { ownerId, conversationId: id }
            : { ownerId, id, conversationId: null },
      });
      if (kind === "generation" && !generations.length) throw notFound();
      if (generations.some((g) => active.includes(g.status)))
        throw new AppError(
          409,
          "BUSY",
          "Wait for the active generation to finish before deleting.",
        );
      await tx.generation.deleteMany({
        where: { ownerId, id: { in: generations.map((g) => g.id) } },
      });
      if (kind === "conversation")
        await tx.conversation.deleteMany({ where: { ownerId, id } });
    },
    { isolationLevel: "ReadCommitted" },
  );
}
export async function usage(ownerId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const u = await db.usageRecord.aggregate({
    where: { ownerId, createdAt: { gte: start } },
    _count: true,
    _sum: { inputTokens: true, outputTokens: true },
  });
  return {
    count: u._count,
    limit: dailyLimit(),
    inputTokens: u._sum.inputTokens ?? 0,
    outputTokens: u._sum.outputTokens ?? 0,
  };
}
export async function pendingJobs() {
  return json<Generation[]>(
    await db.generation.findMany({
      where: { status: { in: active } },
      include: { assets: true },
      take: 5,
      orderBy: { createdAt: "asc" },
    }),
  );
}

export async function requestCancellation(ownerId: string, id: string) {
  const g = await getGeneration(ownerId, id);
  if (g.tool !== "chat" && g.tool !== "code")
    throw new AppError(
      400,
      "UNSUPPORTED",
      "Only text generation can be stopped here.",
    );

  await db.generation.updateMany({
    where: { ownerId, id, status: { in: active } },
    data: { cancelRequested: true },
  });
}
