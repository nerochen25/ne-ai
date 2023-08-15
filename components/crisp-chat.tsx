"use client";

import { useEffect } from "react";
import { Crisp } from "crisp-sdk-web";

export const CrispChat = () => {
  useEffect(() => {
    Crisp.configure("8d8626d8-604d-4a7b-9ab4-b74a7f98f79c");
  }, []);

  return null;
};
