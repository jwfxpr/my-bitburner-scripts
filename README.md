# my-bitburner

My bitburner script repository. This is a learning project for me, to use and learn JavaScript for the first time. As a result, these scripts are idiosyncratic, have grown haphazardly and reactively, may not be particularly obvious or helpful to anyone else, and vary _wildly_ in quality and approach as I learn JavaScript features as I go.

Also, I have mostly not fenced off APIs and features that I have unlocked behind source-file or BitNodeN checks, so if you don't have, e.g., `ns.singularity` unlocked yet, these scripts are really not gonna work for you at all. Soznotsoz.

Some selected portions were taken from other sources:

* [`contract-auto-solver.js`](contract-auto-solver.js) and [`solve-contract.js`](solve-contract.js) from (Reddit? TODO), with updates of my own
* [`infiltration.js`](infiltration.js) from (Reddit? TODO), with updates of my own

Many script names are non-obvious to non-me individuals. I intend to add some header descriptions.

## Batching

I haven't yet bothered to implement batching, so if you're looking for that, keep looking elsewhere. I haven't yet found the work/benefit for batching is there for me, as I find money is pretty easy to get, and there are other more immediate payoffs to improving other areas of the game for me. I imagine as I take on the hardest bitnodes that might change.

## To do

* [ ] Properly credit borrowed code above
* [ ] Header comments to illuminate my (manu)scripts
* [ ] Fully automate corporation development ([`crushMondays.js`](crushMondays.js))
  * [x] Workforce management (hiring, allocations, training)
  * [x] Completed products immediately offered for sale
  * [ ] Research management (partially completed, research pathway still to be expanded)
  * [ ] Product price adjustment (pre MTA.II)
  * [ ] Purchase corporation upgrades
  * [ ] Purchase AdVert, office size
  * [ ] Warehouse management (bulk purchase, expand warehouses)
  * [ ] Product management (discontinue and develop)
  * [ ] Consider: Keep one-time unlocks manual? What about investors, IPO?
* [ ] Smarter sleeves ([`alterCarbon.js`](alterCarbon.js))
* [ ] Pull more shared logic into [`helperlib.js`](helperlib.js)
* [ ] Expand [`database.js`](database.js)
  * [ ] Additional city, location information
  * [ ] Plenty of other shared constants
* [ ] Fix [`navigateTo.js`](navigateTo.js)
* [ ] Batching