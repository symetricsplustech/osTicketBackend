const net = require("node:net");

// Local development has no scanner by default. Once scanning is enabled,
// connection failures and unknown responses reject the upload (fail closed).
async function scanFile(_path, buffer) {
  if (process.env.CLAMAV_ENABLED !== "true" && !process.env.CLAMAV_HOST) {
    return { clean: true };
  }
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: process.env.CLAMAV_HOST || "127.0.0.1",
      port: Number(process.env.CLAMAV_PORT || 3310),
    });
    socket.setTimeout(10000);
    let response = "";
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.length; offset += 65536) {
        const chunk = buffer.subarray(offset, offset + 65536);
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => {
      response += chunk.toString();
      if (!response.includes("\0") && !response.includes("\n")) return;
      socket.end();
      if (/FOUND/.test(response)) resolve({ clean: false, threat: response.trim() });
      else if (/OK/.test(response)) resolve({ clean: true });
      else reject(new Error(`Unexpected scanner response: ${response.trim()}`));
    });
    socket.on("timeout", () => socket.destroy(new Error("Malware scanner timed out")));
    socket.on("error", reject);
    socket.on("close", () => {
      if (!response) reject(new Error("Malware scanner closed without a response"));
    });
  });
}

module.exports = { scanFile };
