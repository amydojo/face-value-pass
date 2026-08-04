# Face Value Pass

A standalone physical-digital entry portal for Face Value.

The portal is deliberately isolated from the Face Value application. It has no API routes, no authentication, no camera access, no local or session storage, no analytics, and no trial-domain imports. Its only outbound action is the final link to the live Face Value instrument.

## Experience

1. Detect and receive the Specimen Pass.
2. Swipe or use the control to inspect front and back.
3. Activate the canonical amber actuator.
4. Watch the card enter the object intake aperture.
5. Read the three-step Face Value system explanation.
6. Enter the live instrument at `https://face-value-seven.vercel.app/?source=specimen-pass`.

## Architecture

Dependency-free static HTML, CSS, and JavaScript. The site can be deployed directly to Vercel with no build command and no output directory configuration.

## Intended production domain

`https://pass.facevalue.undone.design`

Attach that subdomain directly to the standalone `face-value-pass` Vercel project. Do not proxy it through the Face Value application.

## Physical QA gate

Do not generate the final printed QR until all of the following pass on a physical iPhone in Safari:

- the production custom domain loads over HTTPS
- the card enters without horizontal viewport clipping
- front/back swipe works
- the actuator sequence completes
- reduced-motion mode remains usable
- `ENTER THE INSTRUMENT` reaches the production Face Value app
- browser Back returns safely to the pass portal
