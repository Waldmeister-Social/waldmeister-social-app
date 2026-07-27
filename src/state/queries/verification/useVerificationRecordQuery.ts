import {type AppBskyGraphVerification, AtUri} from '@atproto/api'
import {useQuery} from '@tanstack/react-query'

import {SLINGSHOT_SERVICE} from '#/lib/constants'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'

export type VerificationRecord = {
  /** The subject's handle frozen at the moment of verifying. */
  handle: string
  /** The subject's display name frozen at the moment of verifying. */
  displayName: string
  createdAt: string
}

const verificationRecordQueryKeyRoot = 'verification-record'

/**
 * Fetches the body of an `app.bsky.graph.verification` record from the issuer's
 * repo. The Constellation backlink index only gives us the record's identity,
 * so this is how we recover `createdAt` and the frozen handle/displayName needed
 * to compute strict validity. Only enabled where we actually need the body (the
 * verifications dialog), so we don't pay for it on every badge.
 *
 * Waldmeister Fork: Since each PDS only holds the records it has issued,
 * we use slingshot to fetch the record from the issuer's PDS instead of the local PDS.
 */
export function useVerificationRecordQuery({
  uri,
  enabled,
}: {
  uri: string
  enabled: boolean
}) {
  return useQuery<VerificationRecord>({
    queryKey: createQueryKey(verificationRecordQueryKeyRoot, {uri}),
    enabled: enabled && !!uri,
    staleTime: STALE.MINUTES.FIVE,
    queryFn: async () => {
      const atUri = new AtUri(uri)

      // Fetch the record from the issuer's PDS using slingshot (no auth required)
      const url = new URL('/xrpc/com.atproto.repo.getRecord', SLINGSHOT_SERVICE)
      url.searchParams.set('repo', atUri.host)
      url.searchParams.set('collection', atUri.collection)
      url.searchParams.set('rkey', atUri.rkey)

      const res = await fetch(url.toString(), {
        headers: {accept: 'application/json'},
      })
      if (!res.ok) {
        throw new Error(`Slingshot getRecord failed: ${res.status}`)
      }
      const json = (await res.json()) as {
        value: AppBskyGraphVerification.Record
      }
      const value = json.value

      return {
        handle: value.handle,
        displayName: value.displayName ?? '',
        createdAt: value.createdAt,
      }
    },
  })
}
