import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// Shared by SuccessView (fresh purchase) and ReceiptModal (past transaction)
// — captures whatever receipt view is attached to the returned ref and
// shares it as a PNG. A "Share PDF" path used to exist too, but it just
// embedded this same screenshot inside an HTML/PDF shell (expo-print),
// producing a blurry, non-selectable image that only looked like a document
// — removed per QA feedback (Screenshot #26) rather than rebuilt as real
// text/vector content.
export default function useReceiptShare() {
  const receiptRef = useRef(null);
  const [sharing, setSharing] = useState(null); // 'image' | null

  const captureReceipt = () =>
    captureRef(receiptRef, { format: 'png', quality: 1, result: 'tmpfile' });

  const handleShareImage = async () => {
    setSharing('image');
    try {
      const uri = await captureReceipt();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing Unavailable', "Sharing isn't supported on this device.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Receipt' });
    } catch (err) {
      Alert.alert('Could Not Share', err.message || 'Please try again.');
    } finally {
      setSharing(null);
    }
  };

  return { receiptRef, sharing, handleShareImage };
}
