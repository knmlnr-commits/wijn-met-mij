/*
 * Minimale ZIP-schrijver (zonder compressie), zodat start.html een pakketje
 * kan maken zonder externe bibliotheken. Gebruik: makeZip([{ name, text }])
 * geeft een Blob terug.
 */
(function () {
  "use strict";

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  function u16(v) { return [v & 0xff, (v >>> 8) & 0xff]; }
  function u32(v) { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }

  window.makeZip = function makeZip(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const { time, day } = dosDateTime(new Date());

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = typeof file.text === "string" ? encoder.encode(file.text) : new Uint8Array(file.text || []);
      const crc = crc32(data);

      const local = new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(time), ...u16(day), ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(name.length), ...u16(0)
      ]);
      parts.push(local, name, data);

      central.push(new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(time), ...u16(day), ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)
      ]), name);

      offset += local.length + name.length + data.length;
    }

    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(centralSize), ...u32(offset), ...u16(0)
    ]);

    return new Blob([...parts, ...central, end], { type: "application/zip" });
  };
})();
