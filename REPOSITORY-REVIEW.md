# Public repository review

Reviewed November 12, 2026 using GitHub public API inventory, root trees for all eight non-forks, and source inspection of Smart-Brain and DAPortfolioProjects. Inventory: 16 repositories, eight forks. Non-fork status does not prove original or independent authorship. No authenticated private-repository audit was performed.

| Repository | Classification | Review depth / use |
|---|---|---|
| [Bio](https://github.com/philosophies/Bio) | Non-fork | Root file inventory only; no quality or authorship conclusion |
| [CEmu](https://github.com/philosophies/CEmu) | Fork | Metadata only; do not claim upstream work as original |
| [DAPortfolioProjects](https://github.com/philosophies/DAPortfolioProjects) | Non-fork | Source: COVID SQL script; selected reporting evidence with reproducibility caveats |
| [Digital-Clock](https://github.com/philosophies/Digital-Clock) | Non-fork | Root file inventory only; no quality or authorship conclusion |
| [javascript-algorithms](https://github.com/philosophies/javascript-algorithms) | Fork | Metadata only; do not claim upstream work as original |
| [MagiskOnWSA-1](https://github.com/philosophies/MagiskOnWSA-1) | Fork | Metadata only; do not claim upstream work as original |
| [mop](https://github.com/philosophies/mop) | Fork | Metadata only; do not claim upstream work as original |
| [My-Website](https://github.com/philosophies/My-Website) | Non-fork | Root file inventory only; no quality or authorship conclusion |
| [nba_api](https://github.com/philosophies/nba_api) | Fork | Metadata only; do not claim upstream work as original |
| [philosophies.github.io](https://github.com/philosophies/philosophies.github.io) | Non-fork | Root file inventory only; no quality or authorship conclusion |
| [python-pdf-audo](https://github.com/philosophies/python-pdf-audo) | Fork | Metadata only; do not claim upstream work as original |
| [Robofriend](https://github.com/philosophies/Robofriend) | Non-fork | Root file inventory only; no quality or authorship conclusion |
| [Smart-Brain](https://github.com/philosophies/Smart-Brain) | Non-fork | Source: server, route controllers, frontend flow and package manifests; modernization case study |
| [StockSharp](https://github.com/philosophies/StockSharp) | Fork | Metadata only; do not claim upstream work as original |
| [Temperature-Convertor](https://github.com/philosophies/Temperature-Convertor) | Non-fork | Root file inventory only; no quality or authorship conclusion |
| [youtube](https://github.com/philosophies/youtube) | Fork | Metadata only; do not claim upstream work as original |

## Source findings

- Smart-Brain: React 16.2 / react-scripts 1.0.17, Express 4.16, Knex 0.14, pg 7.4 and bcrypt-nodejs in reviewed manifests. The server uses local database settings and unrestricted CORS. Profile lookup and image count updates use client-supplied IDs without authentication middleware in the reviewed server. API node_modules are tracked. Clarifai controller has a placeholder API key; this is not evidence of a leaked real key. No live production endpoint was tested.
- DAPortfolioProjects: one SQL file demonstrates joins, CTEs, aggregations, window functions, temporary-table/view work. Not all divisions guard zero denominators; source tables/data loading are absent from the root inventory. Death/case ratios should not be described as an individual probability of dying without epidemiological qualification. The portfolio makes a narrow SQL-structure claim and does not endorse the analysis conclusions.
- Small frontend and website repositories are supporting history rather than primary backend evidence. No public C# project was visible in the reviewed repository roots; this does not establish the absence of private or nested C# work.

## Reviewed source identity

- Bio: API root-tree SHA `46f3d5eace8a51e26310dbf12eeaea686bcc82f9`; files: index.html, resume_website.zip, style.css.
- DAPortfolioProjects: API root-tree SHA `9b129c6b0e1c26012d29930c94b7ab5c8b5a0345`; files: Covid Portfolio Project 1.sql.
- Digital-Clock: API root-tree SHA `15d5522bb98e8c22fde30936e2f42a7d4f6780ae`; files: README.md, apps.js, index.html, pattern.png, styles.css.
- My-Website: API root-tree SHA `86d1dfa24f72adb5895bf40f5083235e9d415e91`; files: README.md, index.html, main.css, page2.html, page3.html.
- philosophies.github.io: API root-tree SHA `487f8402f7da8e7b2ed113383c3c6c7428e9a74f`; files: header.jpg, index.html, style.css.
- Robofriend: API root-tree SHA `4115a8ea0e8521fc0128176bde97e63dd2030ebf`; files: .gitignore, README.md, package-lock.json, package.json, public, robofriends, src.
- Smart-Brain: API root-tree SHA `bd944c2d5baf4729dc5a0274a02c996428ff6cc7`; files: smart-brain-api, smart-brain.
- Temperature-Convertor: API root-tree SHA `4e4132b6b7e9f6bd75f04553ec86dd4ea5664a40`; files: README.md, index.html, styles.css.

Smart-Brain source commit: `bd944c2d5baf4729dc5a0274a02c996428ff6cc7`. New prototype source is AI-assisted and independently generated; no upstream source was copied. Repository descriptions and visible conventions do not establish who wrote each line. Ask the owner to confirm tutorial origins and retain any applicable credits before reusing legacy source.
