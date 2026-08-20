// Turning a rendered card into something a user can post.
//
// Two native modules do the work: react-native-view-shot rasterises a View to a
// temp PNG, expo-sharing hands that file to the OS share sheet (Instagram,
// WhatsApp, Stories, Files — whatever the device offers). Neither exists in
// Expo Go, and neither exists in a native binary built BEFORE these packages
// were added, so every call here is guarded and degrades to a plain text share
// rather than throwing. Same shape as lib/purchases.native.js, for the same
// reason: the JS bundle updates independently of the native layer.
//
// The fallback is not a failure state worth an error dialog — a text post with
// the numbers in it is still a share, just a plainer one.
import { Platform, Share } from 'react-native';

let captureRef = null;
let Sharing = null;
try { ({ captureRef } = require('react-native-view-shot')); } catch (_) {}
try { Sharing = require('expo-sharing'); } catch (_) {}

/** True when this build can actually produce and share an image. */
export async function canShareImage() {
  if (Platform.OS === 'web' || !captureRef || !Sharing) return false;
  try { return await Sharing.isAvailableAsync(); } catch (_) { return false; }
}

/**
 * Capture `viewRef` and open the share sheet with it.
 *
 * `fallbackMessage` is posted as text when the image path is unavailable, so
 * the caller must always supply one that reads well on its own.
 *
 * Returns 'image' | 'text' | 'cancelled' so the caller can tell the user what
 * happened without inspecting the modules itself.
 */
export async function shareCard(viewRef, fallbackMessage) {
  if (await canShareImage()) {
    try {
      // A fixed pixel width keeps the export identical across devices — without
      // it the card comes out at the phone's own density, so the same workout
      // posts at 800px wide from one handset and 1600px from another.
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: SHARE_CARD_WIDTH,
        height: Math.round(SHARE_CARD_WIDTH * SHARE_CARD_RATIO),
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: fallbackMessage,
      });
      return 'image';
    } catch (err) {
      // Capture failing is not worth surfacing — fall through to text.
      console.warn('shareCard: image share failed, falling back to text', err);
    }
  }

  try {
    const res = await Share.share({ message: fallbackMessage });
    return res.action === Share.dismissedAction ? 'cancelled' : 'text';
  } catch (_) {
    return 'cancelled';
  }
}

// The card renders at this logical width and aspect. 4:5 portrait is the one
// shape that survives every destination — it is Instagram's tallest in-feed
// crop, and Stories letterbox it cleanly instead of cutting the stats off.
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_RATIO = 1.25;
