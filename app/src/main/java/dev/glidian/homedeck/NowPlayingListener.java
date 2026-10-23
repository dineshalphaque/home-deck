package dev.glidian.homedeck;

import android.service.notification.NotificationListenerService;

/**
 * Exists only so the user can give Home Deck access to media sessions for the music bar: Android ties that access
 * to a notification listener. It overrides nothing, so it never looks at notifications.
 */
public class NowPlayingListener extends NotificationListenerService {
}
