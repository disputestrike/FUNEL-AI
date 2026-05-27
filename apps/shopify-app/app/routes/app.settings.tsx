/**
 * /app/settings â€” connect/disconnect GoFunnelAI, pick the default funnel for
 * lead routing, and toggle order-sync + discount-on-completion features.
 */

import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { Form, useActionData, useLoaderData } from "@remix-run/react"
import { Banner, Button, Card, FormLayout, Layout, Page, Select, Text, TextField, BlockStack } from "@shopify/polaris"
import { authenticate } from "../shopify.server"
import { prisma } from "../shopify.server"
import { funnelClient } from "../funnel-client.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const link = await prisma.funnelLink.findUnique({ where: { shop: session.shop } })
  const funnels = link ? await (await funnelClient(session.shop)).funnels.list({ limit: 200 }) : { data: [] }
  return json({ shop: session.shop, link, funnels: funnels.data })
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const form = await request.formData()
  const op = String(form.get("op"))

  if (op === "connect") {
    // Trigger GoFunnelAI OAuth â€” we redirect through login.gofunnelai.com with
    // ?return_to=<callback>. The callback is /shopify/auth/funnel-callback,
    // which writes the FunnelLink row.
    const redirectUri = `${process.env.SHOPIFY_APP_URL}/shopify/auth/funnel-callback`
    const params = new URLSearchParams({
      client_id: `shopify_${session.shop}`,
      response_type: "code",
      scope: "funnels:read funnels:write leads:write workspaces:read",
      redirect_uri: redirectUri,
      state: session.shop,
    })
    return redirect(`${process.env.FUNNEL_AUTH_BASE ?? "https://login.gofunnelai.com"}/oauth/authorize?${params}`)
  }

  if (op === "disconnect") {
    await prisma.funnelLink.delete({ where: { shop: session.shop } })
    return json({ status: "disconnected" as const })
  }

  if (op === "save") {
    await prisma.funnelLink.update({
      where: { shop: session.shop },
      data: { defaultFunnelId: String(form.get("defaultFunnelId") || "") || null },
    })
    return json({ status: "saved" as const })
  }
  return json({ status: "noop" as const })
}

export default function Settings() {
  const { link, funnels } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  if (!link) {
    return (
      <Page title="Settings">
        <Card>
          <BlockStack gap="300">
            <Text as="p">Connect this store to a GoFunnelAI workspace to start capturing leads and embedding funnels.</Text>
            <Form method="post">
              <input type="hidden" name="op" value="connect" />
              <Button submit variant="primary">Connect to GoFunnelAI</Button>
            </Form>
          </BlockStack>
        </Card>
      </Page>
    )
  }

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          {actionData && "status" in actionData && actionData.status === "saved" && (
            <Banner tone="success">Settings saved.</Banner>
          )}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">GoFunnelAI workspace</Text>
              <Text as="p">Connected to <strong>{link.workspaceName}</strong></Text>
              <Form method="post">
                <input type="hidden" name="op" value="disconnect" />
                <Button submit tone="critical">Disconnect</Button>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Form method="post">
              <input type="hidden" name="op" value="save" />
              <FormLayout>
                <Select
                  label="Default funnel for orphan lead captures"
                  name="defaultFunnelId"
                  value={link.defaultFunnelId ?? ""}
                  options={[{ label: "Ungated inbox", value: "" }].concat(
                    funnels.map((f: any) => ({ label: f.name, value: f.id })),
                  )}
                  onChange={() => {}}
                />
                <TextField label="Shop domain" value={link.shop} disabled autoComplete="off" />
                <Button submit variant="primary">Save</Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
