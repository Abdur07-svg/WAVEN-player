/**
 * WAVEN — Dependency-Free ISO/IEC 18004 QR Code SVG Generator
 * Implements Byte-mode encoding, Galois Field GF(256) Reed-Solomon ECC (Level M),
 * standard Version 1-10 placement, and 8-mask penalty optimization.
 */

(function (global) {
  "use strict";

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);

  (function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function buildGeneratorPoly(ecLen) {
    let poly = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const root = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
      }
      poly = next;
    }
    return poly;
  }

  function computeReedSolomon(dataBytes, ecLen) {
    const gen = buildGeneratorPoly(ecLen);
    const buf = new Uint8Array(dataBytes.length + ecLen);
    buf.set(dataBytes, 0);
    for (let i = 0; i < dataBytes.length; i++) {
      const factor = buf[i];
      if (factor !== 0) {
        for (let j = 0; j < gen.length; j++) {
          buf[i + j] ^= gfMul(gen[j], factor);
        }
      }
    }
    return buf.slice(dataBytes.length);
  }

  // ISO/IEC 18004 Level M (EC bits = 0b00) specifications for Versions 1-10:
  // [version, size, alignCenters, g1Blocks, g1Data, g2Blocks, g2Data, ecPerBlock]
  const VERSION_SPECS_M = [
    [1, 21, [], 1, 16, 0, 0, 10],
    [2, 25, [6, 18], 1, 28, 0, 0, 16],
    [3, 29, [6, 22], 1, 44, 0, 0, 26],
    [4, 33, [6, 26], 2, 32, 0, 0, 18],
    [5, 37, [6, 30], 2, 43, 0, 0, 24],
    [6, 41, [6, 34], 4, 27, 0, 0, 16],
    [7, 45, [6, 22, 38], 4, 31, 0, 0, 18],
    [8, 49, [6, 24, 42], 2, 38, 2, 39, 22],
    [9, 53, [6, 26, 46], 3, 36, 2, 37, 22],
    [10, 57, [6, 28, 50], 4, 43, 1, 44, 26]
  ];

  // ISO 18004 Format info for Level M (00) + mask 0..7 (15-bit BCH XOR 0x5412)
  function computeFormatBits(ecLevelBits, maskIndex) {
    const data = ((ecLevelBits & 0x3) << 3) | (maskIndex & 0x7);
    let rem = data << 10;
    const poly = 0b10100110111;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) {
        rem ^= poly << (i - 10);
      }
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  // ISO 18004 Version info (Versions >= 7, 18-bit BCH)
  function computeVersionBits(version) {
    let rem = version << 12;
    const poly = 0b1111100100101;
    for (let i = 17; i >= 12; i--) {
      if ((rem >> i) & 1) {
        rem ^= poly << (i - 12);
      }
    }
    return (version << 12) | rem;
  }

  function encodeUtf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") {
      return Array.from(new TextEncoder().encode(str));
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return bytes;
  }

  function selectVersionSpec(byteLen) {
    for (const spec of VERSION_SPECS_M) {
      const [ver, , , g1b, g1d, g2b, g2d] = spec;
      const totalDataCw = g1b * g1d + g2b * g2d;
      const countBits = ver >= 10 ? 16 : 8;
      const totalBitsNeeded = 4 + countBits + byteLen * 8;
      if (Math.ceil(totalBitsNeeded / 8) <= totalDataCw) {
        return spec;
      }
    }
    throw new Error("Input exceeds QR Version 10 Level M byte capacity.");
  }

  function buildFinalCodewords(bytes, spec) {
    const [ver, , , g1b, g1d, g2b, g2d, ecPerBlock] = spec;
    const totalDataCw = g1b * g1d + g2b * g2d;
    const bitStream = [];

    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) {
        bitStream.push((val >> i) & 1);
      }
    };

    // Byte mode indicator (0100) + character count
    pushBits(0b0100, 4);
    pushBits(bytes.length, ver >= 10 ? 16 : 8);
    for (const b of bytes) {
      pushBits(b, 8);
    }

    const totalDataBits = totalDataCw * 8;
    const terminatorLen = Math.min(4, totalDataBits - bitStream.length);
    pushBits(0, terminatorLen);
    while (bitStream.length % 8 !== 0) {
      bitStream.push(0);
    }

    const dataCw = [];
    for (let i = 0; i < bitStream.length; i += 8) {
      let byteVal = 0;
      for (let b = 0; b < 8; b++) {
        byteVal = (byteVal << 1) | bitStream[i + b];
      }
      dataCw.push(byteVal);
    }

    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (dataCw.length < totalDataCw) {
      dataCw.push(padBytes[padIdx % 2]);
      padIdx++;
    }

    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;

    for (let i = 0; i < g1b; i++) {
      const slice = new Uint8Array(dataCw.slice(offset, offset + g1d));
      offset += g1d;
      dataBlocks.push(slice);
      ecBlocks.push(computeReedSolomon(slice, ecPerBlock));
    }
    for (let i = 0; i < g2b; i++) {
      const slice = new Uint8Array(dataCw.slice(offset, offset + g2d));
      offset += g2d;
      dataBlocks.push(slice);
      ecBlocks.push(computeReedSolomon(slice, ecPerBlock));
    }

    const interleaved = [];
    const maxDataLen = Math.max(g1d, g2d);
    for (let col = 0; col < maxDataLen; col++) {
      for (const blk of dataBlocks) {
        if (col < blk.length) interleaved.push(blk[col]);
      }
    }
    for (let col = 0; col < ecPerBlock; col++) {
      for (const blk of ecBlocks) {
        interleaved.push(blk[col]);
      }
    }

    return interleaved;
  }

  function createMatrixWithFunctionPatterns(spec) {
    const [ver, size, alignCenters] = spec;
    const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

    const setFunc = (r, c, dark) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      modules[r][c] = dark ? 1 : 0;
      isFunction[r][c] = 1;
    };

    const drawFinder = (topR, leftC) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = topR + dr;
          const c = leftC + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const inBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFunc(r, c, inOuter && (inBorder || inInner));
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      const bit = i % 2 === 0;
      setFunc(6, i, bit);
      setFunc(i, 6, bit);
    }

    // Alignment patterns
    for (const ar of alignCenters) {
      for (const ac of alignCenters) {
        const overlapsFinder =
          (ar <= 8 && ac <= 8) ||
          (ar <= 8 && ac >= size - 9) ||
          (ar >= size - 9 && ac <= 8);
        if (overlapsFinder) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setFunc(ar + dr, ac + dc, dark);
          }
        }
      }
    }

    // Reserve Format Information slots + fixed dark module
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        setFunc(8, i, false);
        setFunc(i, 8, false);
      }
    }
    for (let i = size - 8; i < size; i++) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
    setFunc(size - 8, 8, true);

    // Reserve and write Version Info for Versions >= 7
    if (ver >= 7) {
      const vBits = computeVersionBits(ver);
      for (let i = 0; i < 18; i++) {
        const bit = Boolean((vBits >> i) & 1);
        const a = Math.floor(i / 3);
        const b = (size - 11) + (i % 3);
        setFunc(a, b, bit);
        setFunc(b, a, bit);
      }
    }

    return { modules, isFunction, size };
  }

  function placeDataBits(modules, isFunction, size, codewords) {
    const totalBits = codewords.length * 8;
    let bitIdx = 0;
    let dirUp = true;

    for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
      if (rightCol === 6) rightCol--;
      for (let step = 0; step < size; step++) {
        const r = dirUp ? size - 1 - step : step;
        for (let offset = 0; offset < 2; offset++) {
          const c = rightCol - offset;
          if (isFunction[r][c]) continue;
          let bit = 0;
          if (bitIdx < totalBits) {
            const cw = codewords[bitIdx >> 3];
            bit = (cw >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          modules[r][c] = bit;
        }
      }
      dirUp = !dirUp;
    }
  }

  const MASK_PREDICATES = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  function applyFormatInfo(modules, size, maskIndex) {
    const bits = computeFormatBits(0b00, maskIndex);
    // Copy 1 (top-left finder perimeter): bit 14 (MSB) at (8,0) .. bit 0 (LSB) at (0,8)
    for (let i = 0; i <= 5; i++) modules[8][i] = (bits >> (14 - i)) & 1;
    modules[8][7] = (bits >> 8) & 1;
    modules[8][8] = (bits >> 7) & 1;
    modules[7][8] = (bits >> 6) & 1;
    for (let r = 0; r <= 5; r++) modules[r][8] = (bits >> r) & 1;

    // Copy 2: MSB (bit 14) at (size-1, 8) up to bit 8 at (size-7, 8), then bit 7..0 from (8, size-8) to (8, size-1)
    for (let i = 0; i <= 6; i++) modules[size - 1 - i][8] = (bits >> (14 - i)) & 1;
    for (let i = 0; i <= 7; i++) modules[8][size - 8 + i] = (bits >> (7 - i)) & 1;
  }

  function scoreMaskPenalty(mat, size) {
    let penalty = 0;

    // N1: 5+ consecutive same-color modules in rows and columns
    for (let i = 0; i < size; i++) {
      let rowRun = 1;
      let colRun = 1;
      for (let j = 1; j < size; j++) {
        if (mat[i][j] === mat[i][j - 1]) rowRun++;
        else {
          if (rowRun >= 5) penalty += 3 + (rowRun - 5);
          rowRun = 1;
        }
        if (mat[j][i] === mat[j - 1][i]) colRun++;
        else {
          if (colRun >= 5) penalty += 3 + (colRun - 5);
          colRun = 1;
        }
      }
      if (rowRun >= 5) penalty += 3 + (rowRun - 5);
      if (colRun >= 5) penalty += 3 + (colRun - 5);
    }

    // N2: 2x2 blocks of same color
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = mat[r][c];
        if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // N3: 1:1:3:1:1 finder-like ratio patterns
    const checkPattern = (line) => {
      let count = 0;
      for (let i = 0; i <= line.length - 11; i++) {
        const isPatA =
          line[i] === 1 && line[i + 1] === 0 && line[i + 2] === 1 &&
          line[i + 3] === 1 && line[i + 4] === 1 && line[i + 5] === 0 &&
          line[i + 6] === 1 && line[i + 7] === 0 && line[i + 8] === 0 &&
          line[i + 9] === 0 && line[i + 10] === 0;
        const isPatB =
          line[i] === 0 && line[i + 1] === 0 && line[i + 2] === 0 &&
          line[i + 3] === 0 && line[i + 4] === 1 && line[i + 5] === 0 &&
          line[i + 6] === 1 && line[i + 7] === 1 && line[i + 8] === 1 &&
          line[i + 9] === 0 && line[i + 10] === 1;
        if (isPatA || isPatB) count += 40;
      }
      return count;
    };

    for (let i = 0; i < size; i++) {
      penalty += checkPattern(mat[i]);
      const col = new Int8Array(size);
      for (let r = 0; r < size; r++) col[r] = mat[r][i];
      penalty += checkPattern(col);
    }

    // N4: dark ratio deviation from 50%
    let dark = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (mat[r][c]) dark++;
      }
    }
    const pct = (dark * 100) / (size * size);
    const k = Math.floor(Math.abs(pct - 50) / 5);
    penalty += k * 10;

    return penalty;
  }

  function generateMatrix(text) {
    const bytes = encodeUtf8Bytes(text);
    const spec = selectVersionSpec(bytes.length);
    const codewords = buildFinalCodewords(bytes, spec);
    const { modules, isFunction, size } = createMatrixWithFunctionPatterns(spec);

    placeDataBits(modules, isFunction, size, codewords);

    let bestMask = 0;
    let bestScore = Infinity;
    let bestMatrix = null;

    for (let mask = 0; mask < 8; mask++) {
      const candidate = modules.map((row) => new Int8Array(row));
      const pred = MASK_PREDICATES[mask];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!isFunction[r][c] && pred(r, c)) {
            candidate[r][c] ^= 1;
          }
        }
      }
      applyFormatInfo(candidate, size, mask);
      const score = scoreMaskPenalty(candidate, size);
      if (score < bestScore) {
        bestScore = score;
        bestMask = mask;
        bestMatrix = candidate;
      }
    }

    return {
      version: spec[0],
      size,
      mask: bestMask,
      matrix: bestMatrix
    };
  }

  /**
   * Renders an accessible, single-path crisp SVG QR code with white quiet zone.
   */
  function renderQrSvg(text, options = {}) {
    const quietZone = Number.isInteger(options.quietZone) ? options.quietZone : 4;
    const darkColor = options.darkColor || "#0f172a";
    const bgColor = options.bgColor || "#ffffff";
    const ariaLabel = options.ariaLabel || "QR Code for WAVEN APK Download";

    const { size, matrix } = generateMatrix(text);
    const total = size + quietZone * 2;
    const pathParts = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          pathParts.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
        }
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
      `role="img" aria-label="${String(ariaLabel).replace(/"/g, "&quot;")}" shape-rendering="crispEdges">` +
      `<rect width="${total}" height="${total}" rx="2" fill="${bgColor}"/>` +
      `<path d="${pathParts.join("")}" fill="${darkColor}"/>` +
      `</svg>`
    );
  }

  global.WavenQrCode = Object.freeze({
    generateMatrix,
    renderQrSvg
  });
})(typeof window !== "undefined" ? window : globalThis);
