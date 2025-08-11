# authjs-steam-provider

Auth.js v5 provider for Steam OpenID. Minimal, edge-friendly, and typed. It plugs directly into NextAuth/Auth.js and exchanges the Steam OpenID assertion for a session, then enriches the profile via Steam Web API.

• Provider ID: `steam`
• Peer deps: `next (>=13 <16)`, `next-auth (>=5.0.0-beta.18 <6)`

---

## Installation

```bash
npm install authjs-steam-provider
# or
yarn add authjs-steam-provider
```

You also need a Steam Web API Key.
Get it at: https://steamcommunity.com/dev/apikey

---

## Requirements and Configuration

Set the following environment variables:

- NEXTAUTH_URL: Your public app URL (e.g. https://example.com)
- STEAM_API_KEY: Your Steam Web API key

Provider options (required):

- `clientSecret`: The Steam Web API key
- `callbackUrl`: Absolute callback base URL for your NextAuth callback route, e.g. `${NEXTAUTH_URL}/api/auth/callback`

Notes:

- The provider constructs `openid.return_to` as `${callbackUrl}/steam` and validates the OpenID assertion against it.
- Works on the Edge runtime (no Node-specific APIs).

---

## Usage (Next.js App Router, Auth.js v5)

File: `app/api/auth/[...nextauth]/route.ts`

```ts
import NextAuth from "next-auth"
import SteamProvider from "authjs-steam-provider"

export const { handlers, auth } = NextAuth({
  providers: [
    // Important: pass the Request to the provider
    (req) =>
      SteamProvider(req, {
        clientSecret: process.env.STEAM_API_KEY!,
        callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback`,
      }),
  ],
})

export const GET = handlers.GET
export const POST = handlers.POST
```

Client-side sign-in:

```ts
import { signIn } from "next-auth/react"

// triggers the Steam OpenID flow
await signIn("steam")
```

Accessing the session:

```ts
import { auth } from "@/app/api/auth/[...nextauth]/route"

export default async function Page() {
  const session = await auth()
  // session.user has id, name, email (synthetic), image
  return <pre>{JSON.stringify(session, null, 2)}</pre>
}
```

---

## API Reference

### Default export

```ts
SteamProvider(req: Request, options: SteamProviderOptions): OAuthConfig<SteamProfile>
```

- `req`: The Next.js Request of the current auth route handler.
- `options`:
  - `clientSecret: string` — Steam Web API key.
  - `callbackUrl: string | URL` — Base callback URL (e.g. `${NEXTAUTH_URL}/api/auth/callback`).
  - You may also pass standard `OAuthUserConfig<SteamProfile>` fields via `options` (as it extends Partial of it), if needed.

### Profile mapping

`profile(profile: SteamProfile)` returns:

```ts
{
  id: profile.steamid,
  image: profile.avatarfull,
  email: `${profile.steamid}@steamcommunity.com`, // synthetic (Auth.js requires an email)
  name: profile.personaname,
}
```

### Authorization flow

- Initiates OpenID via `https://steamcommunity.com/openid/login`.
- Validates assertion server-side with `openid.mode=check_authentication`.
- Extracts `steamId` from the claimed identifier.
- Fetches player summary using `ISteamUser/GetPlayerSummaries` with `clientSecret` and `steamId`.

### Types

`SteamProviderOptions` (from `src/types/steam.ts`):

```ts
interface SteamProviderOptions {
  callbackUrl: string | URL
  clientSecret: string
}
```

`SteamProfile` is compatible with Steam Web API player summary, including at least:

```ts
interface SteamProfile {
  steamid: string
  personaname: string
  avatar: string
  avatarmedium: string
  avatarfull: string
  profileurl: string
  // …additional fields from Steam
}
```

Provider constants:

- `PROVIDER_ID = "steam"`
- `PROVIDER_NAME = "Steam"`
- `AUTHORIZATION_URL = "https://steamcommunity.com/openid/login"`

---

## Best Practices and Tips

- Ensure `NEXTAUTH_URL` matches your deployed domain (including protocol).
- `callbackUrl` must be absolute and point to your NextAuth callback base: `${NEXTAUTH_URL}/api/auth/callback`.
- Use a dedicated environment variable for `STEAM_API_KEY`; never commit it.
- If you customize session callbacks, keep the `user.id` sourced from `profile.steamid` to maintain stable identity.
- The email is synthetic to satisfy Auth.js serialization; don’t use it for outbound email.
- Prefer running the auth route on Edge for lower latency; this provider is edge-safe.
- Handle errors gracefully in UI; Steam may return non-OK responses if the user is private or API is down.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Links

- Auth.js Docs (v5): https://authjs.dev
- Issues / Contributing: https://github.com/goncalojbsousa/authjs-steam-provider/issues