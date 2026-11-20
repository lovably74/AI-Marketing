import type { Metadata } from "next";
import { AdminApp } from "@/components/AdminApp";

export const metadata: Metadata = {
  title: "모델 관리 | T-LINK AI Marketing Studio",
};

export default function AdminPage() {
  return <AdminApp />;
}
