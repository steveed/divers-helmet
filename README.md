# Diver's Helmet Solver

A solver for Meffert's Diver's Helmet, a Skewb in the shape of a ball. Paint the coloured arcs on a 3D ball to match your scrambled puzzle and the page finds the shortest sequence of turns back to four rings, then walks you through them with animations.

Live at https://steveed.github.io/divers-helmet/

## How it works

- `model.js` models the puzzle as a sphere cut by the four great circles perpendicular to the cube diagonals: 6 diamonds and 8 triangles. The 48 places an arc can sit are the quarters of a ring around each of the 12 points where four pieces meet.
- One triangle (the anchor) is held still, so there are 8 turns: 4 corners, each a third of a turn either way.
- The solver runs IDA* with two pruning tables, one for the triangles and one for the diamonds. Each table is built at solve time from the solved states that match the pieces you entered. Real positions solve in 11 turns or fewer, usually in well under a second.

## Development

Everything runs in docker:

```sh
make test   # run the model and solver tests
make serve  # serve the page at http://localhost:8080
```

Every push to `main` runs the tests and deploys the page to GitHub Pages.
