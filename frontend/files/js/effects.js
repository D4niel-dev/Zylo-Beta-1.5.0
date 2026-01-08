
/**
 * effects.js - Profile Visual Effects
 */

function applyBannerEffect(effect) {
    console.log('Applying banner effect:', effect);
    const bannerImg = document.getElementById('bannerImage');
    const settingsBanner = document.getElementById('settingsBanner');

    // Reset styles
    [bannerImg, settingsBanner].forEach(el => {
        if (!el) return;
        el.className = el.className.replace(/banner-effect-\w+/g, '');
        el.style.boxShadow = '';
        el.style.border = '';
        el.style.filter = '';
        el.style.animation = '';
    });

    if (effect && effect !== 'none') {
        if (effect === 'matrix') {
            [bannerImg, settingsBanner].forEach(el => {
                if (el) {
                    el.style.setProperty('filter', 'url(#matrix-filter) contrast(1.2) brightness(0.8)', 'important');
                    console.log('Applied matrix to:', el.id);
                }
            });
        } else if (effect === 'glitch') {
            [bannerImg, settingsBanner].forEach(el => {
                if (el) {
                    el.style.setProperty('animation', 'glitch-anim 2s infinite linear alternate-reverse', 'important');
                    console.log('Applied glitch to:', el.id);
                }
            });
        } else if (effect === 'neon-glow') {
            [bannerImg, settingsBanner].forEach(el => {
                if (el) {
                    el.style.setProperty('box-shadow', '0 0 30px rgba(255, 0, 255, 0.8), 0 0 60px rgba(0, 255, 255, 0.6)', 'important');
                    el.style.setProperty('border', '3px solid rgba(255, 0, 255, 0.7)', 'important');
                    console.log('Applied neon-glow to:', el.id, el.style.boxShadow);
                }
            });
        }
        console.log('Banner effect applied:', effect);
    } else {
        console.log('No banner effect (none)');
    }
}

function applyAvatarEffect(effect) {
    console.log('Applying avatar effect:', effect);
    const avatarImg = document.getElementById('avatarImage');
    const settingsAvatar = document.getElementById('settingsAvatar');

    console.log('Avatar elements found:', { avatarImg: !!avatarImg, settingsAvatar: !!settingsAvatar });

    // Remove all effect classes and inline styles first
    [avatarImg, settingsAvatar].forEach(el => {
        if (!el) return;
        el.className = el.className.replace(/avatar-effect-\w+/g, '');  // Remove old classes
        el.style.boxShadow = '';  // Remove inline styles
        el.style.animation = '';
        el.style.filter = '';
        el.style.border = '';
        const ring = el.parentElement?.querySelector('.avatar-effect-ring');  // Remove overlay/ring elements
        if (ring) ring.remove();
    });

    if (effect && effect !== 'none') {
        console.log('Applying avatar effect:', effect);
        if (effect === 'glow') {  // Apply new effects using inline styles for reliability
            [avatarImg, settingsAvatar].forEach(el => {
                if (el) {
                    el.style.setProperty('box-shadow', '0 0 10px rgba(99, 102, 241, 0.6), 0 0 20px rgba(59, 130, 246, 0.4), 0 0 30px rgba(236, 72, 153, 0.3)', 'important');
                    el.style.setProperty('animation', 'glowPulse 3s ease-in-out infinite', 'important');
                    console.log('Applied glow to avatar:', el.id, el.style.boxShadow);
                }
            });

        } else if (effect === 'pulse') {
            [avatarImg, settingsAvatar].forEach(el => {
                if (el) {
                    el.style.setProperty('animation', 'pulseAvatar 2s ease-in-out infinite', 'important');
                    console.log('Applied pulse to avatar:', el.id);
                }
            });

        } else if (effect === 'ring') {
            [avatarImg, settingsAvatar].forEach(el => {
                if (el && el.parentElement) {
                    let ring = el.parentElement.querySelector('.avatar-effect-ring');
                    if (!ring) {
                        ring = document.createElement('div');
                        ring.className = 'avatar-effect-ring';
                        ring.style.cssText = 'position: absolute; inset: -8px; border-radius: 50%; background: conic-gradient(from 0deg, rgba(96,165,250,0.6), rgba(167,139,250,0.55), rgba(244,114,182,0.5), rgba(96,165,250,0.6)); filter: blur(2px); z-index: -1; pointer-events: none; animation: ringRotate 3s linear infinite;';
                        el.parentElement.style.position = 'relative';
                        el.parentElement.appendChild(ring);
                    }
                }
            });

        } else if (effect === 'sparkle') {
            [avatarImg, settingsAvatar].forEach(el => {
                if (el) {
                    el.style.setProperty('box-shadow', '0 0 8px rgba(255, 255, 255, 0.8), 0 0 16px rgba(255, 255, 255, 0.6)', 'important');
                    el.style.setProperty('filter', 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.8))', 'important');
                    console.log('Applied sparkle to avatar:', el.id, el.style.boxShadow);
                }
            });
        }
        console.log('Avatar effect applied:', effect);
    } else {
        console.log('No avatar effect (none)');
    }
}
