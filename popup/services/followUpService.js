export async function getFollowUpState() {
  return new Promise(resolve => {
    chrome.storage.local.get({ followedUpMap: {}, respondedMap: {} }, resolve);
  });
}

export function markFollowedUp(threadId) {
  const now = Date.now();
  return new Promise(resolve => {
    chrome.storage.local.get({ followedUpMap: {} }, ({ followedUpMap }) => {
      followedUpMap[threadId] = now;
      chrome.storage.local.set({ followedUpMap }, () => resolve(now));
    });
  });
}

export function updateRespondedState(threadId, isChecked, currentFollowedUpAt) {
  const now = Date.now();

  return new Promise(resolve => {
    chrome.storage.local.get({ respondedMap: {}, followedUpMap: {} }, ({ respondedMap, followedUpMap }) => {
      if (isChecked) {
        respondedMap[threadId] = true;
        if (!currentFollowedUpAt) {
          followedUpMap[threadId] = now;
        }
      } else {
        delete respondedMap[threadId];
        if (followedUpMap[threadId] === currentFollowedUpAt) {
          delete followedUpMap[threadId];
        }
      }

      chrome.storage.local.set({ respondedMap, followedUpMap }, () => {
        resolve({ followedUpAt: followedUpMap[threadId] || null });
      });
    });
  });
}
