/**
 * Minimal typed Substack client. Drop-in for any Node 18+ runtime (fetch is
 * built-in). For browser use, wrap calls in your own CORS proxy — Substack
 * doesn't return permissive CORS headers.
 *
 * Usage:
 *   const client = new Substack('s%3A...your.cookie.value');
 *   const me = await client.me();
 *   const pub = me.publicationUsers.find(p => p.is_primary)!.publication;
 *   const draft = await client.createDraft(pub.subdomain, {
 *     title: 'Hello', subtitle: 'World', html: '<p>...</p>'
 *   });
 *   await client.publishDraft(pub.subdomain, draft.id);
 */

export interface SubstackPublication {
  id: number;
  name: string;
  subdomain: string;
  logo_url?: string;
}

export interface SubstackPublicationUser {
  publication: SubstackPublication;
  role: string;        // 'admin', 'editor', etc.
  is_primary: boolean;
}

export interface SubstackProfile {
  id: number;
  name: string;
  handle: string;
  bio?: string;
  photo_url?: string;
  publicationUsers: SubstackPublicationUser[];
}

export interface SubstackDraft {
  id: number;
  draft_title: string;
  draft_subtitle: string;
  slug: string;
}

export class Substack {
  constructor(private readonly cookie: string) {
    if (!cookie) throw new Error('Substack: cookie is required');
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Cookie: `connect.sid=${this.cookie}; substack.sid=${this.cookie}`,
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
      ...extra,
    };
  }

  private async req<T>(host: string, path: string, init?: RequestInit): Promise<T> {
    const url = `https://${host}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: this.headers(init?.body ? { 'Content-Type': 'application/json' } : {}),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Substack ${init?.method || 'GET'} ${path}: ${res.status} ${body.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  /** GET your profile + the list of publications you can post to. */
  async me(): Promise<SubstackProfile> {
    return this.req<SubstackProfile>('substack.com', '/api/v1/user/profile/self');
  }

  /** GET drafts on a publication — also a permission check (403 if not admin). */
  async listDrafts(subdomain: string, limit = 25): Promise<SubstackDraft[]> {
    return this.req<SubstackDraft[]>(`${subdomain}.substack.com`, `/api/v1/drafts?limit=${limit}`);
  }

  /** Create a draft. Returns the draft's id + slug. */
  async createDraft(
    subdomain: string,
    opts: { title: string; subtitle?: string; html: string },
  ): Promise<SubstackDraft> {
    return this.req<SubstackDraft>(`${subdomain}.substack.com`, '/api/v1/drafts', {
      method: 'POST',
      body: JSON.stringify({
        draft_title: opts.title,
        draft_subtitle: opts.subtitle || '',
        draft_body: opts.html,
        type: 'newsletter',
      }),
    });
  }

  /** Update an existing draft (preserves draft URL). */
  async updateDraft(
    subdomain: string,
    draftId: number,
    opts: { title: string; subtitle?: string; html: string },
  ): Promise<void> {
    await this.req(`${subdomain}.substack.com`, `/api/v1/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify({
        draft_title: opts.title,
        draft_subtitle: opts.subtitle || '',
        draft_body: opts.html,
      }),
    });
  }

  /** Delete a draft. 404 (already gone) is treated as success. */
  async deleteDraft(subdomain: string, draftId: number): Promise<void> {
    try {
      await this.req(`${subdomain}.substack.com`, `/api/v1/drafts/${draftId}`, { method: 'DELETE' });
    } catch (err) {
      if (err instanceof Error && /\b404\b/.test(err.message)) return;
      throw err;
    }
  }

  /**
   * Publish a draft. send=true emails subscribers — IRREVERSIBLE.
   * send=false publishes to web only.
   */
  async publishDraft(
    subdomain: string,
    draftId: number,
    opts: { send: boolean; shareAutomatically?: boolean } = { send: true },
  ): Promise<{ slug: string; post_date: string }> {
    return this.req(`${subdomain}.substack.com`, `/api/v1/drafts/${draftId}/publish`, {
      method: 'PUT',
      body: JSON.stringify({
        send: opts.send,
        share_automatically: opts.shareAutomatically ?? false,
      }),
    });
  }
}
