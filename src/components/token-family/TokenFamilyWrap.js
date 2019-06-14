import PropTypes from 'prop-types';
import React, { PureComponent, useRef } from 'react';
import { TouchableHighlight } from 'react-native';
import { withNavigation } from 'react-navigation';
import { compose, withHandlers } from 'recompact';
import { UniqueTokenRow } from '../unique-token';
import { View, Text } from 'react-primitives';
import { withOpenFamilyTabs } from '../../hoc';
import { Transitioning, Transition } from 'react-native-reanimated';
import TokenFamilyHeader from './TokenFamilyHeader';

enhanceRenderItem = compose(
  withNavigation,
  withHandlers({
    onPress: ({ assetType, navigation }) => (item) => {
      navigation.navigate('ExpandedAssetScreen', {
        asset: item,
        type: assetType,
      });
    },
  }),
);

const UniqueTokenItem = this.enhanceRenderItem(UniqueTokenRow);

const getHeight = (openFamilyTab) => (
  openFamilyTab ?
    UniqueTokenRow.getHeight(false, false) + 100 :
    100
)

const header = (child) => {
  return child;
}

class TokenFamilyWrap extends PureComponent {
  collectiblesRenderItem = item => {
    if (this.props.openFamilyTabs[item.item[0][0].rowNumber]) {
      const tokens = [];
      for(let i = 0; i < item.item.length; i++) {
        tokens.push(<UniqueTokenItem isLastRow={item.isLastRow} isFirstRow={item.isFirstRow} item={item.item[i]} assetType="unique_token" />)
      }
      return tokens;
    }
  };

  onHeaderPress = () => {
    this.props.setOpenFamilyTabs(this.props.item[0][0].rowNumber);
  }

  render() {
    return (
      <View>
        <TouchableHighlight 
          onPress={this.onHeaderPress}
          underlayColor="none"  
        >
        <TokenFamilyHeader familyName={this.props.familyName}/>
        </TouchableHighlight>
        {header(this.collectiblesRenderItem(this.props))}
      </View>
    );
  }
}

TokenFamilyWrap.propTypes = {
  item: PropTypes.object,
};

TokenFamilyWrap.getHeight = getHeight;

export default withOpenFamilyTabs(TokenFamilyWrap);
