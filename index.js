import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import App from './App';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F0F13', padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#FF6B6B', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            App crashed — copy this and send it:
          </Text>
          <ScrollView>
            <Text style={{ color: '#A1A1AA', fontSize: 12, fontFamily: 'monospace' }}>
              {this.state.error?.toString()}{'\n\n'}{this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function Root() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

registerRootComponent(Root);
