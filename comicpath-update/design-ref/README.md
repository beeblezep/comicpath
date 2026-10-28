# Design reference — canvas UI refresh

Source files exported from the "Linked Cards Exploration" design canvas.
Lo-fi wireframe and interaction foundation only; final look and feel is TBD.

## primary/
- `ArrowsMetroB7-x0rp.dc.html` — Metro lines, Path B starts at Title 7.
  This is the direction to build from.

## explorations/
Earlier explorations. Use only where the primary reference is silent.

- `Main.dc.html` — 1 · Card anatomy & link states
- `Hub.dc.html` — 2 · Focus card + grouped links
- `Map.dc.html` — 3 · Link map
- `Explore.dc.html` — 4 · Highlight links (interactive)
- `MapClusters.dc.html` — 3b · Link map at scale, clustered
- `MapRadial.dc.html` — 3c · Link map at scale, radial overview
- `MapExpand.dc.html` — 3d · Expand in place + re-focus
- `MapExpand-39s6.dc.html` — 3e · Expand in place + re-focus (copy)
- `MapColumns.dc.html` — 3e · Expand into columns
- `ArrowsEncodings.dc.html` — 5a · Connector encodings
- `ArrowsCurved.dc.html` — 5b · Curved strokes
- `ArrowsMetro.dc.html` — 5c · Metro lines
- `ArrowsMetroB7.dc.html` — 5c′ · Metro lines, Path B starts at Title 7
- `ArrowsFocus.dc.html` — 5d · Trace on select

## About the file format
These `.dc.html` files were written for the design tool's own runtime.
They load a `support.js` that isn't included, so they won't render if
opened directly in a browser. Read them as source: markup for layout,
the `<script type="text/x-dc">` block for data and interaction logic.
