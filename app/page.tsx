import { DM_Mono, Instrument_Serif, Libre_Baskerville } from "next/font/google";
import { redirect } from "next/navigation";

import { LandingPageShell } from "@/components/landing-page-shell";
import { getAuthenticatedUser } from "@/lib/integrations/supabase-server";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-landing-display",
});

const body = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-landing-body",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-landing-mono",
});

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/workspace");
  }

  return (
    <LandingPageShell
      fontClassName={`${display.variable} ${body.variable} ${mono.variable}`}
      workspaceHref="/auth?next=/workspace"
    />
  );
}
