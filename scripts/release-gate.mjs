const confirmed = process.env.GHESSE_RIGHTS_CONFIRMED === '1'
if (!confirmed) {
  console.error('PUBLIC RELEASE BLOCKED: vocabulary redistribution rights are not documented in this repository.')
  console.error('Review CONTENT_PROVENANCE.md. Set GHESSE_RIGHTS_CONFIRMED=1 only after evidence is retained with the release.')
  process.exit(1)
}
console.log('Rights gate acknowledged for this release environment.')
