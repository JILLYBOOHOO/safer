if (!global.Headers) {
  global.Headers = class Headers {
    constructor(init) {
      this.map = {};
      if (init) {
        if (init instanceof Headers) {
          this.map = { ...init.map };
        } else if (Array.isArray(init)) {
          init.forEach(([k, v]) => this.set(k, v));
        } else {
          Object.entries(init).forEach(([k, v]) => this.set(k, v));
        }
      }
    }
    append(name, value) {
      this.map[name.toLowerCase()] = (this.map[name.toLowerCase()] || '') + ', ' + value;
    }
    delete(name) {
      delete this.map[name.toLowerCase()];
    }
    get(name) {
      return this.map[name.toLowerCase()] || null;
    }
    has(name) {
      return name.toLowerCase() in this.map;
    }
    set(name, value) {
      this.map[name.toLowerCase()] = value;
    }
    forEach(callback) {
      Object.entries(this.map).forEach(([k, v]) => callback(v, k, this));
    }
  };
}

global.WebSocket = global.WebSocket || require('ws');

const ffmpeg = require('fluent-ffmpeg');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_KEY || 'placeholder'
);

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'emergency-media-logs';

/**
 * Connects to RTSP, captures 10s MP4 audio/video, uploads to Supabase, and wipes local files.
 * Falls back to uploading a generated mock/emergency log file if ffmpeg fails or is not present.
 */
async function captureAndUploadEmergencyStream() {
  const rtspUrl = process.env.EMERGENCY_RTSP_STREAM;
  const timestamp = Date.now();
  const tempFileName = `emergency_${timestamp}.mp4`;
  const tempFilePath = path.join(__dirname, tempFileName);

  console.log(`[RTSP Engine] Starting emergency stream capture from ${rtspUrl}...`);

  if (!rtspUrl) {
    console.warn('[RTSP Engine] RTSP stream URL is empty. Generating static text-based telemetry report instead.');
    return await fallbackTelemetryReport(timestamp);
  }

  return new Promise((resolve) => {
    // 10s capture parameter configuration
    ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport tcp',
        '-t 10' // Max 10 seconds
      ])
      .output(tempFilePath)
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-strict experimental'
      ])
      .on('end', async () => {
        console.log('[RTSP Engine] Completed 10s recording. Uploading to Supabase Storage.');
        try {
          const fileBuffer = fs.readFileSync(tempFilePath);
          const uploadPath = `captures/${tempFileName}`;
          
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uploadPath, fileBuffer, {
              contentType: 'video/mp4',
              cacheControl: '3600'
            });

          if (error) throw error;

          console.log('[RTSP Engine] Successfully uploaded stream file to Supabase:', uploadPath);
          
          // Instant local cleanup
          fs.unlinkSync(tempFilePath);
          
          resolve({
            success: true,
            type: 'video',
            url: `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${uploadPath}`
          });
        } catch (uploadErr) {
          console.error('[RTSP Engine] Supabase upload failed:', uploadErr.message);
          // Cleanup local file even if upload failed
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          resolve(await fallbackTelemetryReport(timestamp, `Video capture saved locally but upload failed: ${uploadErr.message}`));
        }
      })
      .on('error', async (err) => {
        console.warn(`[RTSP Engine] FFmpeg RTSP process failed (${err.message}). Defaulting to mock telemetry package.`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        resolve(await fallbackTelemetryReport(timestamp, `FFmpeg capture failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Dynamic fallback reporter that packages system telemetry parameters into a .json payload 
 * and stores it on Supabase Storage to satisfy the offline capture fallback requirements.
 */
async function fallbackTelemetryReport(timestamp, errorMsg = 'No RTSP Source Found') {
  const tempFileName = `telemetry_report_${timestamp}.json`;
  const tempFilePath = path.join(__dirname, tempFileName);
  
  const telemetry = {
    event: 'CRITICAL_SECURITY_DURESS',
    timestamp: new Date().toISOString(),
    status: 'CAMERA_OFFLINE',
    reason: errorMsg,
    system_load: process.cpuUsage(),
    memory_footprint: process.memoryUsage(),
    platform: process.platform
  };

  try {
    fs.writeFileSync(tempFilePath, JSON.stringify(telemetry, null, 2));
    const fileBuffer = fs.readFileSync(tempFilePath);
    const uploadPath = `telemetry/${tempFileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uploadPath, fileBuffer, {
        contentType: 'application/json'
      });

    fs.unlinkSync(tempFilePath);

    if (error) throw error;

    console.log('[RTSP Engine] Telemetry log uploaded to Supabase:', uploadPath);
    return {
      success: true,
      type: 'telemetry_json',
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${uploadPath}`
    };
  } catch (err) {
    console.error('[RTSP Engine] Telemetry log upload failed:', err.message);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  captureAndUploadEmergencyStream
};
