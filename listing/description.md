# Example temperature sensor

The **TS-1** is an invented temperature and humidity logger. It is the
reference JavaScript device type of the GimasiLM Device Type Store: copy it
to start your own.

What it reports:

- temperature, humidity and battery voltage (plotted over time, latest value
  on the device page);
- high / low temperature and tamper alarms (events);
- its configuration: measurement interval and alarm thresholds;
- firmware version and last reset reason;
- a history frame with up to 60 past temperatures.

Payload format: see `decode.js`.
