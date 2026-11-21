RAPID VOLT - WEBSITE
====================

Live site: https://www.rapid-volt.com  (see CNAME)

FILES
-----
index.html        Home page: hero with a 3D product viewer, a scroll-driven 3D
                  showcase, services, why-us, contact. The ad loader lives here
                  and nowhere else.
cart.html         Shop: catalogue, search, category filters, 3D previews, cart,
                  and order form.
article.html      About Us.
products.txt      The product list the shop reads (see below).
assets/css/upgrade.css   Styles for the new layout and 3D components.
assets/js/product3d.js   3D viewer (procedural models, loads Three.js on demand).
assets/js/home.js        Home page: hero cycling and scroll showcase.
assets/js/shop.js        Shop: catalogue, cart, 3D modal, order sending.
robots.txt, sitemap.xml  For search engines.

ADDING OR CHANGING PRODUCTS
---------------------------
Edit products.txt. Format:

    #CategoryName
    Product name | price in AED

- A line starting with # starts a new category. Use one of: Lighting,
  CablingAccessories, HardwareAndFixings, Tools, Consumables. Any other name
  still works, but it gets no icon and shows its raw name as the label.
- A price of 0 (or no price) shows "Price on request".
- Save the file and reload the shop. No other changes are needed.

3D MODELS
---------
Each product gets a 3D model generated from its name. The name decides the
shape (see kindFor() in assets/js/product3d.js):

    light     LED downlights and lights (name contains light, led, lamp)
    cable     cables (cable, ducab, cx)
    gland     cable glands
    lug       cable lugs (word "lug"/"lugs")
    tie       cable ties and clips
    fitting   saddles, adopters, tray couplers
    holesaw   hole saws
    bit       drill and concrete bits
    nut       nuts
    fastener  screws, bolts, plugs
    bottle    glue
    hdmi      HDMI extenders
    box       anything else (a generic box)

To give a product a better shape, add a keyword to kindFor() and a builder
to BUILDERS in product3d.js. Everything is drawn in code, so no model files
are needed.

The 3D library (Three.js r128) loads from cdnjs, with jsDelivr as a fallback.
If it cannot load, or the visitor's device has no WebGL, the site shows plain
icons instead and everything else still works.

HOME PAGE SHOWCASE
------------------
The four products in the scroll showcase are set in index.html, in the
<div class="rv-step"> blocks. Each has data-name (the product name as it
appears in products.txt) and data-icon (a Font Awesome icon for the fallback).
Add or remove blocks and set --rv-steps on the <section id="showcase"> to match.

ORDERS
------
Orders are posted as JSON to the Cloudflare Worker URL at the top of
assets/js/shop.js. The payload shape is unchanged from the original site.
Items priced on request are sent with a unit price of 0 and are excluded from
the total. Confirm those items with the customer.

CART
----
The cart is saved in the visitor's browser (localStorage) so it survives page
reloads. It is cleared after an order is sent successfully.

ADVERTISING
-----------
The ad script at the bottom of index.html is the only ad on the site. It is not
on the shop or About pages. Keep ads visible to visitors. Hiding them makes
impressions that no one sees, which ad networks treat as invalid traffic.

VERIFICATION
------------
d457ab8760645a4eafb4.txt is a site-verification file. Keep it in the root.
