'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Key,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  AlertTriangle,
  Shield,
  Wallet,
  User,
  Mail
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { getPrivateKey, getUserInfo } from '@/lib/web3auth';
import { formatAddress } from '@/lib/utils';

export const Settings = () => {
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAppStore();
  const addNotification = useAppStore((state) => state.addNotification);

  const handleExportPrivateKey = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const key = await getPrivateKey();
      if (key) {
        setPrivateKey(key);
        // Also fetch user info
        const info = await getUserInfo();
        setUserInfo(info);
      } else {
        setError('Could not retrieve private key. This feature is only available for Web3Auth wallets.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export private key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPrivateKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopied(true);
      addNotification({
        type: 'success',
        title: 'Copied',
        message: 'Private key copied to clipboard'
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleHidePrivateKey = () => {
    setPrivateKey(null);
    setShowPrivateKey(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-surface-700 flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-surface-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Account Settings</h2>
          <p className="text-surface-400">Manage your wallet and account settings</p>
        </div>
      </div>

      {/* Account Info */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-appex-400" />
          Account Information
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-surface-400" />
              <div>
                <p className="text-sm text-surface-400">Wallet Address</p>
                <p className="font-mono">{user?.address || 'Not connected'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (user?.address) {
                  navigator.clipboard.writeText(user.address);
                  addNotification({ type: 'success', title: 'Copied', message: 'Address copied' });
                }
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-surface-400" />
              <div>
                <p className="text-sm text-surface-400">Authentication</p>
                <p className="font-medium capitalize">{user?.authenticationType || 'Unknown'}</p>
              </div>
            </div>
            <Badge variant={user?.authenticationType === 'web3auth' ? 'success' : 'default'}>
              {user?.authenticationType === 'web3auth' ? 'Social Login' : 'Wallet'}
            </Badge>
          </div>

          {userInfo && (
            <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-surface-400" />
                <div>
                  <p className="text-sm text-surface-400">Email</p>
                  <p className="font-medium">{userInfo.email || 'Not available'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Private Key Export */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-yellow-500" />
          Export Private Key
        </h3>

        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-400">Security Warning</p>
              <p className="text-sm text-surface-400 mt-1">
                Your private key gives complete control over your wallet. Never share it with anyone.
                Store it securely offline. Anyone with access to your private key can steal your funds.
              </p>
            </div>
          </div>
        </div>

        {user?.authenticationType === 'web3auth' ? (
          <>
            {!privateKey ? (
              <div className="space-y-4">
                <p className="text-surface-400">
                  As a Web3Auth user, you have full custody of your wallet. You can export your 
                  private key to import into another wallet like MetaMask.
                </p>
                <Button
                  onClick={handleExportPrivateKey}
                  isLoading={isLoading}
                  leftIcon={<Key className="w-4 h-4" />}
                  variant="secondary"
                >
                  Export Private Key
                </Button>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-surface-800 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-surface-400">Your Private Key</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="p-2 rounded hover:bg-surface-700"
                      >
                        {showPrivateKey ? (
                          <EyeOff className="w-4 h-4 text-surface-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-surface-400" />
                        )}
                      </button>
                      <button
                        onClick={handleCopyPrivateKey}
                        className="p-2 rounded hover:bg-surface-700"
                      >
                        {copied ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-surface-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-sm break-all bg-surface-900 p-3 rounded">
                    {showPrivateKey ? privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                </div>

                <div className="p-4 bg-surface-800/50 rounded-lg">
                  <h4 className="font-medium mb-2">How to import into MetaMask:</h4>
                  <ol className="text-sm text-surface-400 space-y-2 list-decimal list-inside">
                    <li>Open MetaMask and click on your account icon</li>
                    <li>Select "Import Account"</li>
                    <li>Choose "Private Key" as the import type</li>
                    <li>Paste your private key and click "Import"</li>
                  </ol>
                </div>

                <Button
                  variant="ghost"
                  onClick={handleHidePrivateKey}
                  className="text-surface-400"
                >
                  Hide Private Key
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          <div className="p-4 bg-surface-800/50 rounded-lg">
            <p className="text-surface-400">
              You're connected via {user?.authenticationType || 'external wallet'}. 
              Your private key is managed by your wallet application (e.g., MetaMask).
              To export your private key, use your wallet's built-in export feature.
            </p>
          </div>
        )}
      </Card>

      {/* Import to MetaMask Guide */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Self-Custody Explained</h3>
        <div className="space-y-4 text-surface-400">
          <p>
            AppEx uses Web3Auth for social logins, which creates a <strong className="text-white">self-custodial wallet</strong>. 
            This means:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>You own your private key - not AppEx, not Web3Auth</li>
            <li>Your key is split using threshold cryptography across multiple parties</li>
            <li>Only you can reconstruct and access your full private key</li>
            <li>You can export and use your key in any Ethereum wallet</li>
            <li>If Web3Auth disappears, you still have your private key</li>
          </ul>
          <p className="text-sm">
            This is different from custodial services where a company holds your keys. 
            With self-custody, you have full control and responsibility for your assets.
          </p>
        </div>
      </Card>
    </div>
  );
};
