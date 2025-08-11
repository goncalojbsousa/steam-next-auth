import { OAuthConfig } from "next-auth/providers"
import { SteamProfile, SteamProviderOptions } from "./types/steam"
import { AUTHORIZATION_URL, EMAIL_DOMAIN, LOGO_URL, PROVIDER_ID, PROVIDER_NAME } from "./constants/steam"


export default function SteamProvider(
  req: Request,
  options: SteamProviderOptions
): OAuthConfig<SteamProfile> {
  if (!options.clientSecret || options.clientSecret.length < 1)
    throw new Error('You have forgot to set your Steam API Key in the `clientSecret` option. Please visit https://steamcommunity.com/dev/apikey to get one.')
  
  const callbackUrl = new URL(options.callbackUrl)
  const realm = callbackUrl.origin
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
      // next.js can't serialize the session if email is missing or null, so I specify user ID
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
 * Verifies an assertion and returns the claimed identifier if authenticated, otherwise null.
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