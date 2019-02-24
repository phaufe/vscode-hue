import * as vscode from 'vscode';

import Huetility from './hue/huetility';
import { AttemptToRegisterBridgeCallback, BridgeItem, BridgeConfiguration } from './hue/bridge';

const BRIDGE_IS_REGISTERED_CONTEXT = 'hue.bridgeIsRegistered';

const getExistingConfiguration = () => {
  const existingConfig: BridgeConfiguration | undefined = (vscode.workspace.getConfiguration()).get('hue.bridge');
  const existingBridgeConfiguration = existingConfig && new BridgeConfiguration(existingConfig.id, existingConfig.ipAddress, existingConfig.username);
  return existingBridgeConfiguration;
}

export async function activate(context: vscode.ExtensionContext) {
  const registerBridgeCommand = vscode.commands.registerCommand('extension.hue.registerBridge', async () => {
    // Check if Hue Bridge configuration exists and registered
    const existingBridgeConfiguration = getExistingConfiguration();
    if (existingBridgeConfiguration && existingBridgeConfiguration.isRegistered()) {
      const existingBridgeItem = new BridgeItem(existingBridgeConfiguration);
      // Hue Bridge settings already exists, proceed and replace current settings?
      const overrideSettingDecision: { label: string, value: boolean } | undefined = await vscode.window.showQuickPick<{ label: string, value: boolean }>([{
        label: 'No',
        value: false
      }, {
        label: 'Yes',
        value: true
      }], {
        canPickMany: false,
        ignoreFocusOut: false,
        placeHolder: `You have Hue Bridge ${existingBridgeItem.helpMessage} registered in your settings. Do you want to proceed and replace the current settings anyway?`
      });
      if (!overrideSettingDecision || (overrideSettingDecision && !overrideSettingDecision.value)) {
        return;
      }
    }

    // Either we can't find Hue Bridge settings or user wants to replace their current settings
    const bridges = await Huetility.discover();
    if (!bridges) {
      vscode.window.showWarningMessage('Unable to find Hue Bridge. Make sure that your Hue Bridge is connected to your network your computer is currently on.');
      return;
    }
    const bridgeItems = bridges.map((bridge: any) => new BridgeItem(
        new BridgeConfiguration(bridge.id, bridge.internalipaddress))
    );
    const selectedBridge = await vscode.window.showQuickPick<BridgeItem>(bridgeItems, {
      canPickMany: false,
      ignoreFocusOut: false,
      placeHolder: 'Select a Hue Bridge you want to register'
    });
    if (!selectedBridge) {
      return;
    }
    const registeredUsername = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Please press the 'link' button on the Hue Bridge you are registering",
      cancellable: true
    }, AttemptToRegisterBridgeCallback(selectedBridge));
    if (!registeredUsername) {
      vscode.window.showErrorMessage('Unable to register Hue Bridge. Please try again');
      return;
    }
    selectedBridge.setUsername(registeredUsername);
    await (vscode.workspace.getConfiguration()).update('hue.bridge', selectedBridge.configuration);
    vscode.window.showInformationMessage(`Hue Bridge ${selectedBridge.helpMessage} has successfully been registered.`);
    vscode.commands.executeCommand('setContext', BRIDGE_IS_REGISTERED_CONTEXT, true);
  });

  context.subscriptions.push(registerBridgeCommand);

  // Commands that need Bridge registration before they are made
  const existingBridgeConfiguration = getExistingConfiguration();
  if (existingBridgeConfiguration && existingBridgeConfiguration.isRegistered()) {
    vscode.commands.executeCommand('setContext', BRIDGE_IS_REGISTERED_CONTEXT, true);
    const registerNewLightsCommand = vscode.commands.registerCommand('extension.hue.registerNewLights', () => {
      vscode.window.showInformationMessage('Hello Hue');
    });
    context.subscriptions.push(registerNewLightsCommand);
  }
}

export function deactivate() {}