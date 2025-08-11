/**
 * Steam OpenID provider for Auth.js (NextAuth.js v5 style).
 *
 * This module exposes a factory `SteamProvider()` that returns an `OAuthConfig` configured
 * to perform OpenID 2.0 authentication against Steam. It also includes an internal
 * `verifyAssertion()` helper to validate Steam's OpenID response in a framework-agnostic way.
 */
import { OAuthConfig } from "next-auth/providers"
import { SteamProfile, SteamProviderOptions } from "./types/steam"
import { AUTHORIZATION_URL, EMAIL_DOMAIN, LOGO_URL, PROVIDER_ID, PROVIDER_NAME } from "./constants/steam"


/**
 * Creates a Steam provider configuration for Auth.js.
 *
 * - `req` is the incoming request (used to read the callback query when Steam redirects back).
 * - `options.clientSecret` must be your Steam Web API Key.
 * - `options.callbackUrl` must point to your Auth callback base URL (e.g. `https://site.com/api/auth/callback`).
 */
export default function SteamProvider(
  req: Request,
  options: SteamProviderOptions
): OAuthConfig<SteamProfile> {
  if (!options.clientSecret || options.clientSecret.length < 1)
    throw new Error('You have forgot to set your Steam API Key in the `clientSecret` option. Please visit https://steamcommunity.com/dev/apikey to get one.')
  
  // Build OpenID realm and return_to. OpenID 2.0 requires both.
  // realm: the base origin expected by the RP (your site)
  const callbackUrl = new URL(options.callbackUrl)
  const realm = callbackUrl.origin
  // return_to: the exact URL Steam will redirect back to after auth
  const returnTo = `${callbackUrl.href}/${PROVIDER_ID}`
  
  return {
    clientId: PROVIDER_ID,
    clientSecret: options.clientSecret,
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    type: 'oauth',
    style: {
      logo: LOGO_URL,
      bg: '#000',
      text: '#fff',
    },
    // OpenID 2.0 does not support PKCE/state like modern OAuth2; Auth.js checks are disabled here.
    checks: ['none'],
    authorization: {
      url: AUTHORIZATION_URL,
      params: {
        'openid.mode': 'checkid_setup',
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.return_to': returnTo,
        'openid.realm': realm
      }
    },
    token: {
      url: `${callbackUrl}/steam`,
      async conform() {
        if (!req.url) {
          throw new Error('No URL found in request object')
        }

        const identifier = await verifyAssertion(req, realm, returnTo)

        if (!identifier) {
          throw new Error('Unauthenticated')
        }
        // Respond with a pseudo access token and the extracted steamId.
        // Auth.js will pass this through to `userinfo.request` below.
        return Response.json({
          // id_token: globalThis.crypto.randomUUID(),
          access_token: globalThis.crypto.randomUUID(),
          steamId: identifier,
          token_type: 'Bearer'
        })
      }
    },
    
    userinfo: {
      url: `${callbackUrl}/steam`,
      async request(ctx:any) {
        try {
          // Fetch public profile from Steam Web API using the steamId obtained above.
          const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002')
          url.searchParams.set('key', ctx.provider.clientSecret as string)
          url.searchParams.set('steamids', ctx.tokens.steamId as string)

          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Steam API error: ${response.status} ${response.statusText}`)
          }
          const data = await response.json()
          if (!data?.response?.players?.[0]) {
            throw new Error('Steam profile not found')
          }
          return data.response.players[0]
        } catch (err) {
          throw new Error(`Failed to fetch Steam user info: ${(err as Error).message}`)
        }
      }
    },
    profile(profile: SteamProfile) {
      // Next.js can't serialize the session if email is missing/null.
      // Provide a synthetic email derived from steamid to satisfy Auth.js constraints.
      return {
        id: profile.steamid,
        image: profile.avatarfull,
        email: `${profile.steamid}@${EMAIL_DOMAIN}`,
        name: profile.personaname
      }
    }
  }
}

/**
 * Validates Steam's OpenID 2.0 assertion and extracts the SteamID64.
 *
 * Returns the numeric SteamID (as string) when the assertion is valid, otherwise `null`.
 */
async function verifyAssertion(
  req: Request,
  realm: string,
  returnTo: string
): Promise<string | null> {
  // Validation based on passport-steam logic
  const IDENTIFIER_PATTERN = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/
  const OPENID_CHECK = {
    ns: 'http://specs.openid.net/auth/2.0',
    claimed_id: 'https://steamcommunity.com/openid/id/',
    identity: 'https://steamcommunity.com/openid/id/'
  }

  const url = new URL(req.url!, 'https://example.com')
  const params = new URLSearchParams(url.search)

  if (params.get('openid.op_endpoint') !== AUTHORIZATION_URL || params.get('openid.ns') !== OPENID_CHECK.ns) {
    return null
  }
  const claimed = params.get('openid.claimed_id') || ''
  const identity = params.get('openid.identity') || ''
  if (!claimed.startsWith(OPENID_CHECK.claimed_id)) {
    return null
  }
  if (!identity.startsWith(OPENID_CHECK.identity)) {
    return null
  }
  // Optional: ensure return_to and realm match what we expect
  if (params.get('openid.return_to') !== returnTo) {
    return null
  }

  // Build verification payload: same params but with mode=check_authentication
  const verifyParams = new URLSearchParams()
  for (const [k, v] of params.entries()) {
    if (k === 'openid.mode') continue
    verifyParams.set(k, v)
  }
  verifyParams.set('openid.mode', 'check_authentication')

  const resp = await fetch(AUTHORIZATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verifyParams.toString(),
    // Edge friendly; no Node-specific options
  })
  if (!resp.ok) return null
  const text = await resp.text()
  // Response lines like: ns:...\nis_valid:true
  const isValid = /is_valid\s*:\s*true/i.test(text)
  if (!isValid) return null

  const match = claimed.match(IDENTIFIER_PATTERN)
  if (!match) return null
  return match[1]
}