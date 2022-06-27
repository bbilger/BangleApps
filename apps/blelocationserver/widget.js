// WIDGETS = {}; // <-- for development only

(() => {

function setKthBit(number, k) {
  return number | 1 << k;
}

const positionStatusType = {
  noPosition: 0,
  positionOk: 1,
  estimatedPosition: 2,
  lastKnownPosition: 3
};
const distanceFormatType = {
  twoD: 0,
  threeD: 1
};
const elevationSourceType = {
  positioningSystem: 0,
  barometricAirPressure: 1,
  databaseService: 2,
  other: 3
};
const headingSourceType = {
  movement: 0,
  mageticCompass: 1
};

function intToSignedBits(i, size) {
  if (i < 0) {
    return (1 << size - 1) + (i & ((1 << size - 1) - 1));
  }
  return i;
}

function setInt24Le(view, offset, value) {
  value = intToSignedBits(value, 24);
  view.setUint16(offset, value, true);
  view.setUint8(offset + 2, value >> 16, true);
}

function constructData(location) {

  const instantaneousSpeedPresent = !isNaN(location.speed);
  const totalDistancePresent = false;
  const locationPresent = !isNaN(location.lat) && !isNaN(location.lon);
  const elevationPresent = !isNaN(location.alt);
  const compassHeadingPresent = !isNaN(location.course);
  const rollingTimePresent = false;
  const utcTimePresent = false;
  const positionStatus = positionStatusType.positionOk;
  const distanceFormat = distanceFormatType.twoD;
  const elevationSource = elevationSourceType.positioningSystem;
  const headingSource = headingSourceType.movement;
    
  let flags = 0; // uint16
  let bufferSize = 2; // 2 bytes for the flags

  if (instantaneousSpeedPresent) {
    flags = setKthBit(flags, 0);
    bufferSize += 2; // uint16
  }
  if (totalDistancePresent) {
    flags = setKthBit(flags, 1);
    bufferSize += 3; // uint24
  }
  if (locationPresent) {
    flags = setKthBit(flags, 2);
    bufferSize += 4; // sint32 - lat
    bufferSize += 4; // sint32 - lon
  }
  if (elevationPresent) {
    flags = setKthBit(flags, 3);
    bufferSize += 3; // sint24
  }
  if (compassHeadingPresent) {
    flags = setKthBit(flags, 4);
    bufferSize += 2; // uint16
  }
  if (rollingTimePresent) {
    flags = setKthBit(flags, 5);
    bufferSize += 1; // uint8
  }
  if (utcTimePresent) {
    flags = setKthBit(flags, 6);
    bufferSize += 0; // TODO how large is this???
  }

  if (positionStatus == positionStatusType.lastKnownPosition) {
    flags = setKthBit(flags, 7);
    flags = setKthBit(flags, 8);
  } else if (positionStatus == positionStatusType.positionOk) {
    flags = setKthBit(flags, 7);
  } else if (positionStatus == positionStatusType.estimatedPosition) {
    flags = setKthBit(flags, 8);     
  } // else if (positionStatus == positionStatusType.noPosition) ... nothing to do

  if (distanceFormat == distanceFormatType.threeD) {
    flags = setKthBit(flags, 9);     
  } // else if (distanceFormat == distanceFormatType.twoD) ... nothing to do

  if (elevationSource == elevationSourceType.other) {
    flags = setKthBit(flags, 10);
    flags = setKthBit(flags, 11);
  } else if (elevationSource == elevationSourceType.databaseService) {
    flags = setKthBit(flags, 11);
  } else if (elevationSource == elevationSourceType.barometricAirPressure) {
    flags = setKthBit(flags, 10);
  } // else if (elevationSource == elevationSourceType.positioningSystem) ... nothing to do

  if (headingSource == headingSourceType.mageticCompass) {
    flags = setKthBit(flags, 12);
  } // else if (headingSource == headingSourceType.movement) ... nothing to do

  const arr = new Uint8Array(bufferSize);
  const view = new DataView(arr.buffer);

  let bufferOffset = 0;

  view.setUint16(bufferOffset, flags, true);
  bufferOffset += 2;

  if (instantaneousSpeedPresent) {
    // unit is in meters per second with a resolution of 1/100
    const speedData = (location.speed * 100.0);
    view.setUint16(bufferOffset, speedData, true);
    bufferOffset += 2;
  }

  if (totalDistancePresent) {
    // unit is in meters with a resolution of 1/10
    const totalDistanceData = (0 * 10.0);
    setInt24Le(view, bufferOffset, totalDistanceData);
    bufferOffset += 3;
  }

  if (locationPresent) {
    const latitudeData = location.lat * Math.pow(10, 7);
    view.setInt32(bufferOffset, latitudeData, true);
    bufferOffset += 4;

    const longitudeData = location.lon * Math.pow(10, 7);
    view.setInt32(bufferOffset, longitudeData, true);
    bufferOffset += 4;
  }

  if (elevationPresent) {
    const altitudeData = location.alt * 100;
    setInt24Le(view, bufferOffset, altitudeData);
    bufferOffset += 3;
  }

  if (compassHeadingPresent) {
    const headingData = location.course * 100.0;
    view.setUint16(bufferOffset, headingData, true);
    bufferOffset += 2;
  }


  return arr;
}

NRF.setServices({
  0x1819 : {
    0x2A67 : {
      value : constructData({
        lat: 52.520008,
        lon: 13.404954,
        alt: 34.0,
        speed: 0.0, 
        course: 0.0
    }),
      readable : true,
      notify : true
    }
  }
}, {  advertise: [ '1819' ] });

Bangle.on('GPS', function(fix) {
  if (fix !== undefined) {
    NRF.updateServices({
      0x1819 : {
        0x2A67 : {
          value : constructData(fix),
          notify : true
        }
      }
    });
  }
});
Bangle.setGPSPower(1);


  function draw() {
    g.reset();
    g.drawImage(require("heatshrink").decompress(atob("i0XxH+CR0HhEHEyEOi1AAAMWhAUNisW6/XwICBi0PHpgUC69WAYUWIpcVxAVGsgsLi2sCAOsg4EDiwVPlZYCCoUzss6IwxBE68rDYJBBldlAAVeNpIADNoNdxIWDssrCYMJgKZDF4SZCxGtCollmcJAALFDnTFE1utxNdrtXq9WqwVDeJAVB1tdrwABFgM6maOKwQWCIQgbBmQVJmQVCCwlXF4LoKCoaHDCoSgFAAldCwYtCqxbCLRQVECwNWr4VBr4VJmYWFrpcDCpM6neJC4pdCChEsss7C4+IFRI4DC4LBKCpBQLAAgA=")), this.x, this.y);
  }
    WIDGETS["blelocationserver"]={
    area:"tl", // tl (top left), tr (top right), bl (bottom left), br (bottom right)
    width: 24, // how wide is the widget? You can change this and call Bangle.drawWidgets() to re-layout
    draw:draw // called to draw the widget
  };
})()

// Bangle.drawWidgets(); // <-- for development only
