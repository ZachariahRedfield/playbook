async function upsertReleasePullRequest({ github, owner, repo, base, head, title, body }) {
  if (!base || !head || !title || !body) {
    throw new Error('upsertReleasePullRequest requires base, head, title, and body.');
  }

  const { data: pulls } = await github.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${head}`,
    base,
    per_page: 100,
  });
  const existing = pulls.find((pull) => pull.head && pull.head.ref === head && pull.base && pull.base.ref === base);

  if (existing) {
    const { data } = await github.rest.pulls.update({
      owner,
      repo,
      pull_number: existing.number,
      title,
      body,
      base,
    });
    return { action: 'updated', number: data.number, html_url: data.html_url };
  }

  const { data } = await github.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
    maintainer_can_modify: false,
  });
  return { action: 'created', number: data.number, html_url: data.html_url };
}

module.exports = { upsertReleasePullRequest };
