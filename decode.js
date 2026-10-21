// Example temperature sensor ("TS-1"), a small invented binary format that
// shows every part of the JavaScript device-type contract.
//
// Every payload starts with a frame type byte. Numbers are big-endian.
//
//   0x01 measurement  flags u8 (bit0 = probe error), temperature s16 (0.01 degC),
//                     humidity u8 (%), battery u16 (mV)                      7 bytes
//   0x02 alarm        code u8 (1 high, 2 low, 3 tamper), raised u8 (0/1),
//                     temperature s16 (0.01 degC), age u16 (s before sending) 7 bytes
//   0x03 config       interval u16 (s), high s16 (0.01 degC), low s16 (0.01 degC) 7 bytes
//   0x04 info         firmware major u8, minor u8, patch u8, reset reason u8  5 bytes
//   0x05 history      count u8, then count x { age u16 (s), temperature s16 } 2 + 4n bytes
//
// input:  { bytes: Uint8Array, topic, imei, receivedAt }   (receivedAt: RFC 3339)
// output: { data: { config, state, timeseries, events }, warnings: [], errors: [] }

var ALARMS = { 1: "TEMP_HIGH", 2: "TEMP_LOW", 3: "TAMPER" };
var RESETS = ["POWER_ON", "WATCHDOG", "BROWNOUT", "SOFTWARE"];

function u16(b, i) { return (b[i] << 8) | b[i + 1]; }
function s16(b, i) { var v = u16(b, i); return v & 0x8000 ? v - 0x10000 : v; }
function centi(v) { return Math.round(v) / 100; }

// The time "age" seconds before the payload was received.
function before(receivedAt, age) {
  return new Date(Date.parse(receivedAt) - age * 1000).toISOString().replace(".000Z", "Z");
}

function need(b, n, name) {
  if (b.length !== n) throw new Error(name + " frame needs " + n + " bytes, got " + b.length);
}

function decodeUplink(input) {
  var b = input.bytes;
  if (b.length === 0) return { errors: ["empty payload"] };
  var data = { state: {}, timeseries: [], events: [], config: {} };
  var warnings = [];
  try {
    switch (b[0]) {
      case 0x01: {
        need(b, 7, "measurement");
        var probeOk = (b[1] & 0x01) === 0;
        var battery = u16(b, 5);
        data.state.probe_ok = probeOk;
        data.state.battery_mv = battery;
        data.timeseries.push({ key: "battery_mv", value: battery });
        if (probeOk) {
          var t = centi(s16(b, 2));
          data.state.temperature = t;
          data.state.humidity = b[4];
          data.timeseries.push({ key: "temperature", value: t });
          data.timeseries.push({ key: "humidity", value: b[4] });
        } else {
          warnings.push("probe error: temperature and humidity not measured");
        }
        if (battery < 2500) warnings.push("battery low (" + battery + " mV)");
        break;
      }
      case 0x02: {
        need(b, 7, "alarm");
        var code = ALARMS[b[1]] || "UNKNOWN_" + b[1];
        data.events.push({
          kind: "alarm",
          ts: before(input.receivedAt, u16(b, 5)),
          body: { code: code, raised: b[2] === 1, temperature: centi(s16(b, 3)) },
        });
        break;
      }
      case 0x03: {
        need(b, 7, "config");
        data.config.measurement_interval_s = u16(b, 1);
        data.config.temp_high_c = centi(s16(b, 3));
        data.config.temp_low_c = centi(s16(b, 5));
        break;
      }
      case 0x04: {
        need(b, 5, "info");
        data.state.fw_version = b[1] + "." + b[2] + "." + b[3];
        data.state.reset_reason = RESETS[b[4]] || "UNKNOWN";
        break;
      }
      case 0x05: {
        var n = b[1];
        need(b, 2 + 4 * n, "history");
        for (var i = 0; i < n; i++) {
          var o = 2 + 4 * i;
          data.timeseries.push({ key: "temperature", ts: before(input.receivedAt, u16(b, o)), value: centi(s16(b, o + 2)) });
        }
        break;
      }
      default:
        return { errors: ["unknown frame type 0x" + b[0].toString(16)] };
    }
  } catch (e) {
    return { errors: [e.message] };
  }
  return { data: data, warnings: warnings };
}
