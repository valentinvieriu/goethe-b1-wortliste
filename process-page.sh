#!/bin/bash

F=Goethe-Zertifikat_B1_Wortliste.pdf
P=$1

# Ensure output directory exists
mkdir -p output

if test ! -f "output/Goethe-Zertifikat_B1_Wortliste-$P.png"; then
  echo "Page $P doesn't exist." >&2
  exit 1
fi

# Y ranges
if [ ! -f output/$P-l.txt -o ! -f output/$P-r.txt ]; then
  echo "$P: Figuring out ranges..."

  convert output/Goethe-Zertifikat_B1_Wortliste-$P.png -crop $[1200-140]x$[3260-320]+140+320 output/$P-l.xpm
  convert output/Goethe-Zertifikat_B1_Wortliste-$P.png -crop $[2340-1300]x$[3260-320]+1300+320 output/$P-r.xpm

  ruby detect-breaks.rb output/$P-l.xpm > output/$P-l.txt
  ruby detect-breaks.rb output/$P-r.xpm > output/$P-r.txt
  rm -f output/$P-l.xpm output/$P-r.xpm
fi

# annotation
if [ ! -f output/$P-annot.png ]; then
  echo "$P: Annotation..."

  cp output/Goethe-Zertifikat_B1_Wortliste-$P.png output/$P-annot.png
  cat output/$P-l.txt | ruby annotate.rb output/$P-annot.png 140 1200 320
  cat output/$P-r.txt | ruby annotate.rb output/$P-annot.png 1300 2340 320
fi

# extraction
if [ ! -f output/$P-r.msh -o ! -f output/$P-l.msh ]; then
  echo "$P: Extraction..."

  ruby extract.rb "$F" $P output/$P-l.txt 140 540 1200 320 l
  ruby extract.rb "$F" $P output/$P-r.txt 1300 1710 2340 320 r
fi

# generation
if [ ! -f output/$P.html -o ! -f output/$P.csv ]; then
  echo "$P: Generation..."

  ruby generate.rb $P
fi
