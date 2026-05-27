import * as React from "react";
import { Heading, Layout, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingCommunityInviteProps {
  first_name?: string;
  community_url: string;
}

export function OnboardingCommunityInvite({ first_name, community_url }: OnboardingCommunityInviteProps): React.ReactElement {
  return (
    <Layout preheader="Come hang out with other builders.">
      <Heading>Come meet the other builders</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}30 industry hubs, daily wins + fails, real
        operators. Lurk if you want — most do at first.
      </Para>
      <PrimaryButton href={community_url}>Join the community</PrimaryButton>
    </Layout>
  );
}
