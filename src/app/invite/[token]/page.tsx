import { InvitationRedeemer } from "@/components/InvitationRedeemer";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  return <InvitationRedeemer token={token} />;
}
