'use client';

import { useEffect, useState } from 'react';

type StepStatus = 'idle' | 'loading' | 'success' | 'error';

interface Step {
    id: string;
    name: string;
    status: StepStatus;
    message: string;
    details?: Record<string, string>;
    hint?: string;
    tokenUsed?: 'user' | 'system';
}

export default function WhatsAppSignup() {
    const [steps, setSteps] = useState<Step[]>([
        { id: '1', name: 'Authorization Code', status: 'idle', message: '' },
        { id: '2', name: 'Exchange Code for Business Token', status: 'idle', message: '' },
        { id: '3', name: 'Subscribe to Webhooks', status: 'idle', message: '' },
        { id: '4', name: 'Register Phone Number', status: 'idle', message: '' },
        { id: '5', name: 'Send Test Message', status: 'idle', message: '' },
    ]);

    const [phoneData, setPhoneData] = useState<any>(null);
    const [businessToken, setBusinessToken] = useState('');
    const [pin, setPin] = useState('');
    const [testPhoneNumber, setTestPhoneNumber] = useState('');
    const [testMessage, setTestMessage] = useState('Hello! This is a test message from WhatsApp Cloud API.');
    const [onboardingPopup, setOnboardingPopup] = useState<Window | null>(null);

    useEffect(() => {
        const initFb = () => {
            const FB = (window as any).FB;
            if (FB && !(window as any)._fbInitialized) {
                FB.init({
                    appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || 'YOUR_APP_ID',
                    autoLogAppEvents: true,
                    xfbml: true,
                    version: 'v20.0',
                });
                (window as any)._fbInitialized = true;
            }
        };

        window.fbAsyncInit = initFb;

        if ((window as any).FB) {
            initFb();
        }

        if (!document.getElementById('facebook-jssdk')) {
            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }

        const handleMessage = (event: MessageEvent) => {
            if (!event.origin.endsWith('facebook.com')) return;

            try {
                const data = JSON.parse(event.data);

                if (data.type === 'WA_EMBEDDED_SIGNUP') {
                    if (data.event === 'FINISH') {
                        setPhoneData({
                            phoneNumberId: data.data.phone_number_id,
                            wabaId: data.data.waba_id,
                            businessId: data.data.business_id,
                        });
                    }

                    if (data.event === 'CANCEL') {
                        updateStep('1', 'error', `User cancelled at step: ${data.data.current_step}`);
                    }
                }

                // Handle onboarding completion
                if (data.type === 'WA_ONBOARDING_COMPLETE') {
                    console.log('[v0] Onboarding complete:', data);
                    if (onboardingPopup) {
                        onboardingPopup.close();
                        setOnboardingPopup(null);
                    }
                    updateStep('1', 'success', 'WhatsApp Business App onboarding completed!', {
                        businessId: data.data?.business_id || 'Completed',
                    });
                }

                if (data.type === 'WA_ONBOARDING_CANCEL') {
                    console.log('[v0] Onboarding cancelled');
                    if (onboardingPopup) {
                        onboardingPopup.close();
                        setOnboardingPopup(null);
                    }
                    updateStep('1', 'error', 'Onboarding was cancelled by user');
                }
            } catch (err) {
                console.log('Raw message:', event.data);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const updateStep = (stepId: string, status: StepStatus, message: string, details?: Record<string, string>, hint?: string, tokenUsed?: 'user' | 'system') => {
        setSteps((prev) =>
            prev.map((step) =>
                step.id === stepId ? { ...step, status, message, details, hint, tokenUsed } : step
            )
        );
    };

    const fbLoginCallback = (response: any) => {
        if (response.authResponse) {
            const authCode = response.authResponse.code;
            updateStep('1', 'success', 'Authorization code received', { code: authCode.substring(0, 50) + '...' });

            // Step 2: Exchange code for business token
            updateStep('2', 'loading', 'Exchanging code for business token...');
            fetch('/api/whatsapp/exchange-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: authCode }),
            })
                .then((tokenRes) => tokenRes.json())
                .then((tokenData) => {
                    if (tokenData.error) {
                        updateStep('2', 'error', tokenData.error, undefined, tokenData.details ? 'Check that your FACEBOOK_APP_SECRET is correct' : undefined);
                        return;
                    }

                    setBusinessToken(tokenData.businessToken);
                    updateStep('2', 'success', 'Business token received', {
                        token: tokenData.businessToken.substring(0, 50) + '...',
                    });
                })
                .catch((error) => {
                    updateStep('2', 'error', `Error: ${(error as Error).message}`);
                });
        } else {
            updateStep('1', 'error', 'Login was cancelled');
        }
    };

    const launchOnboarding = () => {
        const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;

        if (!appId || !configId) {
            updateStep('1', 'error', 'Missing NEXT_PUBLIC_FACEBOOK_APP_ID or NEXT_PUBLIC_FACEBOOK_CONFIG_ID');
            return;
        }

        updateStep('1', 'loading', 'Opening WhatsApp Business App onboarding...');

        const onboardingUrl = `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${configId}&extras=${encodeURIComponent(
            JSON.stringify({
                featureType: 'whatsapp_business_app_onboarding',
                sessionInfoVersion: '3',
                version: 'v3',
            })
        )}`;

        const popup = window.open(onboardingUrl, 'WhatsAppOnboarding', 'width=800,height=600,resizable=yes,scrollbars=yes');

        if (popup) {
            setOnboardingPopup(popup);
            console.log('[v0] Onboarding popup opened');
        } else {
            updateStep('1', 'error', 'Popup was blocked. Please allow popups for this site.');
        }
    };

    const launchWhatsAppSignup = () => {
        const FB = (window as any).FB;
        if (!FB) {
            updateStep('1', 'error', 'Facebook SDK not loaded. Please try again.');
            return;
        }

        updateStep('1', 'loading', 'Opening WhatsApp signup...');

        FB.login(fbLoginCallback, {
            config_id: process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID || 'YOUR_CONFIG_ID',
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {} },
        });
    };

    const subscribeToWebhooks = async () => {
        if (!phoneData || !businessToken) {
            updateStep('3', 'error', 'Missing required data. Complete previous steps first.');
            return;
        }

        updateStep('3', 'loading', 'Subscribing to webhooks...');
        try {
            const res = await fetch('/api/whatsapp/subscribe-webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessToken,
                    wabaId: phoneData.wabaId,
                }),
            });

            const data = await res.json();

            if (data.error) {
                updateStep('3', 'error', data.error, undefined, data.hint);
                return;
            }

            updateStep('3', 'success', 'Successfully subscribed to webhooks', {
                wabaId: phoneData.wabaId,
            }, undefined, data.tokenUsed);
        } catch (error) {
            updateStep('3', 'error', `Error: ${(error as Error).message}`);
        }
    };

    const registerPhone = async () => {
        if (!phoneData || !businessToken || !pin) {
            updateStep('4', 'error', 'Missing required data. Complete previous steps and enter PIN.');
            return;
        }

        updateStep('4', 'loading', 'Registering phone number...');
        try {
            const res = await fetch('/api/whatsapp/register-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessToken,
                    phoneNumberId: phoneData.phoneNumberId,
                    pin,
                }),
            });

            const data = await res.json();

            if (data.error) {
                updateStep('4', 'error', data.error, undefined, data.hint);
                return;
            }

            updateStep('4', 'success', 'Phone number registered successfully', {
                phoneNumberId: phoneData.phoneNumberId,
            }, undefined, data.tokenUsed);
        } catch (error) {
            updateStep('4', 'error', `Error: ${(error as Error).message}`);
        }
    };

    const sendTestMessage = async () => {
        if (!phoneData || !businessToken || !testPhoneNumber || !testMessage) {
            updateStep('5', 'error', 'Missing required data. Enter phone number and message.');
            return;
        }

        updateStep('5', 'loading', 'Sending test message...');
        try {
            const res = await fetch('/api/whatsapp/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessToken,
                    phoneNumberId: phoneData.phoneNumberId,
                    recipientNumber: testPhoneNumber,
                    message: testMessage,
                }),
            });

            const data = await res.json();

            if (data.error) {
                updateStep('5', 'error', data.error, undefined, data.hint);
                return;
            }

            updateStep('5', 'success', 'Test message sent successfully', {
                messageId: data.messageId,
            }, undefined, data.tokenUsed);
        } catch (error) {
            updateStep('5', 'error', `Error: ${(error as Error).message}`);
        }
    };

    const getStepIcon = (status: StepStatus) => {
        switch (status) {
            case 'loading':
                return '⏳';
            case 'success':
                return '✅';
            case 'error':
                return '❌';
            default:
                return '⭕';
        }
    };

    const getStatusColor = (status: StepStatus) => {
        switch (status) {
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'loading':
                return 'bg-blue-50 border-blue-200';
            default:
                return 'bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">WhatsApp Setup</h1>
                    <p className="text-gray-600">Choose a setup method to connect your WhatsApp Business Account</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                    <button
                        onClick={launchOnboarding}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg"
                    >
                        <div className="text-lg mb-1">Full Business Onboarding</div>
                        <div className="text-sm font-normal">Complete setup with Facebook wizard</div>
                    </button>

                    <button
                        onClick={launchWhatsAppSignup}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg"
                    >
                        <div className="text-lg mb-1">Manual Step-by-Step</div>
                        <div className="text-sm font-normal">Token exchange and configuration</div>
                    </button>
                </div>

                {/* <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className={`border-2 rounded-lg p-6 transition-all ${getStatusColor(step.status)}`}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">{getStepIcon(step.status)}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    Step {step.id}: {step.name}
                  </h3>
                  {step.message && <p className="text-sm text-gray-700 mt-2">{step.message}</p>}
                  {step.tokenUsed && (
                    <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded mt-2 font-semibold">
                      Token Source: <span className="uppercase">{step.tokenUsed}</span>
                    </p>
                  )}
                  {step.hint && <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded mt-2">{step.hint}</p>}
                  {step.details && (
                    <div className="mt-3 space-y-1">
                      {Object.entries(step.details).map(([key, value]) => (
                        <p key={key} className="text-xs text-gray-600 font-mono bg-white/50 p-2 rounded">
                          <span className="font-bold">{key}:</span> {value}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {step.id === '3' && steps[1].status === 'success' && step.status !== 'success' && step.status !== 'loading' && (
                <button
                  onClick={subscribeToWebhooks}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                >
                  Subscribe to Webhooks
                </button>
              )}

              {step.id === '4' && steps[2].status === 'success' && step.status !== 'success' && step.status !== 'loading' && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Enter 6-digit PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength="6"
                    className="w-full px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={registerPhone}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Register Phone Number
                  </button>
                </div>
              )}

              {step.id === '5' && steps[3].status === 'success' && step.status !== 'success' && step.status !== 'loading' && (
                <div className="mt-4 space-y-3">
                  <input
                    type="tel"
                    placeholder="Recipient phone number (e.g., +1234567890)"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    placeholder="Test message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendTestMessage}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Send Test Message
                  </button>
                </div>
              )}
            </div>
          ))}
        </div> */}

                {/* <div className="mt-10 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-900 mb-3">📋 Setup Checklist</h3>
          <ul className="space-y-2 text-sm text-yellow-800">
            <li>✓ Add <code className="bg-yellow-100 px-2 py-1 rounded">NEXT_PUBLIC_FACEBOOK_APP_ID</code> to environment variables</li>
            <li>✓ Add <code className="bg-yellow-100 px-2 py-1 rounded">NEXT_PUBLIC_FACEBOOK_CONFIG_ID</code> to environment variables</li>
            <li>✓ Add <code className="bg-yellow-100 px-2 py-1 rounded">FACEBOOK_APP_SECRET</code> to environment variables (server-side)</li>
            <li>✓ Complete all 5 steps in order</li>
          </ul>
        </div> */}
            </div>
        </div>
    );
}
