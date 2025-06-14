# Goethe-Zertifikat B1 Wortliste to CSV | HTML

You can read all about this in my blog post:

- [Extracting data from Goethe Zertifikat B1 Wortliste pdf](https://wejn.org/2023/12/extracting-data-from-goethe-zertifikat-b1-wortliste/)

(and yes, you can find the final output in that blog post, too)

## To run

`make`

But you probably want to have `ruby`, `pdftotext`, `pdftocairo`,
`convert` (imagemagick).

## Docker

You can also run everything inside a container with all dependencies
preinstalled. The Docker build downloads the original PDF so you don't
have to provide it manually.

Build the image:

```sh
docker build -t goethe-b1 .
```

Process the files (results will appear in the current directory):

```sh
docker run --rm -v $(pwd):/app goethe-b1 make
```

## Credits

* Author: Michal Jirků (wejn.org)
* License: AGPL
