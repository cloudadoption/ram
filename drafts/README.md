# drafts

Static page sources for local development. `aem up --html-folder drafts` serves
every `<name>.plain.html` here at `http://localhost:3010/drafts/<name>`, built
with the local `head.html`, scripts, styles and blocks.

This is the verification surface for this project while AEM Code Sync is not
installed on the repo, because the code bus is empty and no branch preview
renders project code. A draft is the page markup exactly as it will be authored
in Document Authoring, so the same file proves the blocks locally and then
becomes the DA page.
