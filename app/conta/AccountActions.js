"use client";

import { useUser } from "@/components/UserContext";
import { LogoutIcon } from "@/components/Icons";

export default function AccountActions() {
  const { logout } = useUser();

  return (
    <button className="btn btn-ghost" onClick={logout} id="btn-account-logout">
      <LogoutIcon width={16} height={16} /> Sair da conta
    </button>
  );
}
