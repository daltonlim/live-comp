# Earned

A local, live Australian salary dashboard for FY 2026–27. It estimates how much of an annual salary has been earned after income tax, Medicare levy, optional Medicare levy surcharge, and optional Division 293 tax.

Run it with:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Settings are saved only in your browser.

The default scenario is $180,000 salary excluding super, eligible hospital cover, $30,000 annual concessional super, and a 9:00–17:00 Sydney workday with a 30-minute break. Change these in **Adjust assumptions**.

Run the calculation checks with `npm test`. No packages need to be installed.
