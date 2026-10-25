# Digital sample room

The bilingual sample room is available at `/en/creative/sample-room` and `/ar/creative/sample-room`. A `product` query parameter selects an active, published listing. It supports anonymous browsing without creating a taste profile or recording personal measurements on the server.

## What is implemented

- Three modes: the actual product preview, a close inspection view, and a composed room scene.
- A bounded public listing image, attached product photographs, and the existing signature-checked gallery service provide all images. The room never requests an original-download endpoint or grants access to private customer artwork.
- Optional angles and model mockups are accepted only from recognized gallery keys, the same product ID, and the current 64-character server signature. A reverse shirt preview is explicitly labelled **unprinted** unless the server supplies a confirmed back-print preview. No front image is flipped to simulate a printed back.
- Confirmed colour choices select their actual attached photograph. CSS recolouring is not used. Choices without a corresponding supported preview remain unavailable rather than inventing an image.
- Image inspection supports 100–400% zoom, keyboard `+`/`-`, arrow-key panning, `0`/`Home`/`Escape` reset, and pointer dragging. The enlarged image contains the same preview detail, not a newly generated print original.
- Side-by-side comparison uses two actual published products. It does not silently change a shopping-bag or order option.
- A wall-art composition accepts wall width and intended print width/height in centimetres. Validated values control the preview rectangle's proportions. Dimensions are entered by the customer; they are not supplier-certified product measurements. The scene is a flat, illustrative spatial guide rather than augmented reality or a physical-size guarantee.
- Product-specific actions return to the actual product page or to the existing private editor when a product is configured as customer-customizable.

Image/metadata failure leaves the existing primary preview usable. Image failures receive an inline retry state. An empty catalogue presents an honest empty room and a route back to the creative hub. Late optional-angle responses append to the thumbnail rail without replacing measurements, entered values, keyboard focus, zoom or the selected image.

## Explicit boundaries

The room uses provisional mockups until approved supplier measurements, physical samples, fabrics, finishes and colour references are available. A model mockup remains labelled as AI-generated. Zoom does not establish print resolution or fabric quality. The composed room is CSS illustration and does not access a camera. No shipping, payment, manufacturing or availability promises are introduced.

Measurements, mode, zoom, comparison and selected product remain in current-page memory. They are not added to analytics, stored as a tracking identifier or published with a customer design. Purchasing decisions must still be confirmed on the product page; inspection alone cannot choose a colour or print side for an order.

## Integration

Load `sample-room.css` and `sample-room.js` with the existing revisioned assets. `window.VeeladSampleRoom` exposes `handles(route)`, `render(route, params)` and `init()`. The creative hub delegates `creative/sample-room` rendering and initialization to this module. Product/gallery APIs retain their existing access controls, rate limits and cache signatures. No new backend endpoint or table is needed.

Browser checks cover English/Arabic, loaded images, real public-preview responses, supported reverse angles, unavailable back views, confirmed colour-photo selection, keyboard inspection, side-by-side comparison, dimension validation, and mobile layout. Tests use isolated local products and images and do not certify supplier output or real Safari compatibility.
