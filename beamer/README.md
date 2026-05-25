# Finance MBA Beamer Starter

This folder starts the 2027 migration plan with:

- `theme_finance_mba.sty`: shared visual style and reusable block conventions.
- `day1_pilot.tex`: a pilot Day 1 deck implementing the first-priority fixes.

## Compile

From this folder:

```bash
pdflatex day1_pilot.tex
```

(Use your preferred LaTeX workflow if available, e.g., `latexmk -pdf day1_pilot.tex`.)


## Overleaf note

If your `main.tex` is at project root, Overleaf expects `theme_finance_mba.sty` to be discoverable from root.
This repository now includes a root-level `theme_finance_mba.sty` shim that forwards to `beamer/theme_finance_mba.sty`, so both of these work:

- `\usepackage{theme_finance_mba}`
- `\usepackage{beamer/theme_finance_mba}`
