import { useNavigation } from '@react-navigation/core';
import { isEmpty, upperFirst } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, KeyboardAvoidingView, View } from 'react-native';

import styled, { useTheme } from 'styled-components';
import { ButtonPressAnimation } from '../../../components/animations';
import colors, { darkModeThemeColors } from '../../../styles/colors';
import { Column, Row } from '../../layout';
import { Text } from '../../text';
import FeesGweiInput from './FeesGweiInput';
import {
  calculateMinerTipAddDifference,
  calculateMinerTipSubstDifference,
} from '@rainbow-me/helpers/gas';
import {
  add,
  greaterThan,
  isZero,
  multiply,
  toFixedDecimals,
} from '@rainbow-me/helpers/utilities';
import { useGas, useTimeout } from '@rainbow-me/hooks';
import { gweiToWei, parseGasFeeParam } from '@rainbow-me/parsers';
import Routes from '@rainbow-me/routes';
import { fonts, fontWithWidth, margin, padding } from '@rainbow-me/styles';
import { gasUtils } from '@rainbow-me/utils';

const Wrapper = styled(KeyboardAvoidingView)``;

const PanelRow = styled(Row).attrs({
  alignItems: 'center',
  justify: 'space-between',
})``;

// GweiInputPill has a vertical padding of 10
const MiddlePanelRow = styled(PanelRow).attrs(() => ({}))`
  ${padding(8, 0)}
`;

const PanelRowThin = styled(Row).attrs({
  justify: 'space-between',
  marginBottom: 5,
})``;

const PanelLabel = styled(Text).attrs({
  lineHeight: 'normal',
  size: 'lmedium',
  weight: 'heavy',
})`
  ${margin(0, 5, 0, 0)};
`;

const PanelWarning = styled(Text).attrs(({ theme: { colors } }) => ({
  color: colors.yellowFavorite,
  lineHeight: 'normal',
  size: 'smedium',
  weight: 'heavy',
}))`
  display: absolute;
  top: -18;
`;

const PanelError = styled(Text).attrs(({ theme: { colors } }) => ({
  color: colors.red,
  lineHeight: 'normal',
  size: 'smedium',
  weight: 'heavy',
}))`
  display: absolute;
  top: -18;
`;

const GasTrendHeader = styled(Text).attrs(({ theme: { colors }, color }) => ({
  color: color || colors.appleBlue,
  size: 'smedium',
  weight: 'heavy',
}))`
  ${margin(0, 5, 0, 0)};
`;

const PanelColumn = styled(Column).attrs(() => ({
  justify: 'center',
}))``;

const Label = styled(Text).attrs(({ size }) => ({
  size: size || 'lmedium',
}))`
  ${({ weight }) => fontWithWidth(weight || fonts.weight.semibold)}
`;

const GAS_FEE_INCREMENT = 1;
const MAX_BASE_FEE_RANGE = [1, 3];
const MINER_TIP_RANGE = [1, 2];

export default function FeesPanel({
  currentGasTrend,
  colorForAsset,
  onCustomGasFocus,
}) {
  const {
    selectedGasFee,
    currentBlockParams,
    gasFeeParamsBySpeed,
    updateToCustomGasFee,
    updateGasFeeOption,
    selectedGasFeeOption,
  } = useGas();
  const { navigate } = useNavigation();
  const { isDarkMode } = useTheme();
  const maxBaseFeeInputRef = useRef();

  const [customMaxPriorityFee, setCustomMaxPriorityFee] = useState(
    selectedGasFee?.gasFeeParams?.maxPriorityFeePerGas?.gwei || 0
  );
  const [customMaxBaseFee, setCustomMaxBaseFee] = useState(
    selectedGasFee?.gasFeeParams?.maxFeePerGas?.gwei || 0
  );
  const [maxPriorityFeeWarning, setMaxPriorityFeeWarning] = useState(null);
  const [maxPriorityFeeError, setMaxPriorityFeeError] = useState(null);
  const [startPriorityFeeTimeout, stopPriorityFeeTimeout] = useTimeout();

  const [maxBaseFeeWarning, setMaxBaseFeeWarning] = useState(null);
  const [maxBaseFeeError, setMaxBaseFeeError] = useState(null);
  const [startBaseFeeTimeout, stopBaseFeeTimeout] = useTimeout();

  const selectedOptionIsCustom = useMemo(
    () => selectedGasFee?.option === gasUtils.CUSTOM,
    [selectedGasFee?.option]
  );

  const { maxFee, currentBaseFee, maxBaseFee, maxPriorityFee } = useMemo(() => {
    const maxFee = selectedGasFee?.gasFee?.maxFee?.native?.value?.display || 0;
    const currentBaseFee = currentBlockParams?.baseFeePerGas?.gwei || 0;

    let maxBaseFee;

    if (selectedOptionIsCustom) {
      // block more than 2 decimals on gwei value
      const decimals = Number(customMaxBaseFee) % 1;
      maxBaseFee =
        `${decimals}`.length > 4
          ? toFixedDecimals(customMaxBaseFee, 0)
          : customMaxBaseFee;
    } else {
      maxBaseFee = toFixedDecimals(
        selectedGasFee?.gasFeeParams?.maxFeePerGas?.gwei || 0,
        0
      );
    }

    let maxPriorityFee;
    if (selectedOptionIsCustom) {
      // block more than 2 decimals on gwei value
      const decimals = Number(customMaxPriorityFee) % 1;
      maxPriorityFee =
        `${decimals}`.length > 4
          ? Number(parseFloat(customMaxPriorityFee).toFixed(2))
          : customMaxPriorityFee;
    } else {
      maxPriorityFee =
        selectedGasFee?.gasFeeParams?.maxPriorityFeePerGas?.gwei || 0;
    }
    return { currentBaseFee, maxBaseFee, maxFee, maxPriorityFee };
  }, [
    selectedGasFee,
    currentBlockParams,
    selectedOptionIsCustom,
    customMaxBaseFee,
    customMaxPriorityFee,
  ]);

  const renderRowLabel = useCallback(
    (label, type, error, warning) => {
      const openGasHelper = () => {
        Keyboard.dismiss();
        navigate(Routes.EXPLAIN_SHEET, {
          currentBaseFee,
          currentGasTrend,
          type,
        });
      };
      let color;
      let text;
      if ((!error && !warning) || !selectedOptionIsCustom) {
        color = isDarkMode
          ? colors.alpha(darkModeThemeColors.blueGreyDark, 0.25)
          : colors.alpha(colors.blueGreyDark, 0.25);
        text = '􀅵';
      } else if (error) {
        color = colors.red;
        text = '􀁟';
      } else {
        color = colors.yellowFavorite;
        text = '􀇿';
      }

      return (
        <PanelColumn>
          <ButtonPressAnimation onPress={openGasHelper}>
            <Row>
              <PanelLabel>
                {`${label} `}
                <Label color={color} size="smedium" weight="bold">
                  {text}
                </Label>
              </PanelLabel>
            </Row>
          </ButtonPressAnimation>
        </PanelColumn>
      );
    },
    [
      currentBaseFee,
      currentGasTrend,
      navigate,
      selectedOptionIsCustom,
      isDarkMode,
    ]
  );

  const formattedBaseFee = useMemo(
    () => `${toFixedDecimals(currentBaseFee, 0)} Gwei`,
    [currentBaseFee]
  );

  const handleOnInputFocus = useCallback(() => {
    if (isEmpty(gasFeeParamsBySpeed[gasUtils.CUSTOM])) {
      const gasFeeParams = gasFeeParamsBySpeed[selectedGasFeeOption];
      updateToCustomGasFee({
        ...gasFeeParams,
        option: gasUtils.CUSTOM,
      });
    } else {
      updateGasFeeOption(gasUtils.CUSTOM);
    }
  }, [
    gasFeeParamsBySpeed,
    selectedGasFeeOption,
    updateGasFeeOption,
    updateToCustomGasFee,
  ]);

  const handleFeesGweiInputFocus = useCallback(() => {
    onCustomGasFocus?.();
    handleOnInputFocus();
    const {
      gasFeeParams: { maxFeePerGas, maxPriorityFeePerGas },
    } = selectedGasFee;
    setCustomMaxPriorityFee(maxPriorityFeePerGas?.gwei || 0);
    setCustomMaxBaseFee(toFixedDecimals(maxFeePerGas?.gwei || 0, 0));
  }, [onCustomGasFocus, handleOnInputFocus, selectedGasFee]);

  const handleCustomPriorityFeeFocus = useCallback(() => {
    handleOnInputFocus();
    handleFeesGweiInputFocus();
  }, [handleFeesGweiInputFocus, handleOnInputFocus]);

  const updatePriorityFeePerGas = useCallback(
    priorityFeePerGas => {
      const maxPriorityFeePerGas =
        selectedGasFee?.gasFeeParams?.maxPriorityFeePerGas;

      const gweiMaxPriorityFeePerGas = Number(maxPriorityFeePerGas?.gwei || 0);

      const newGweiMaxPriorityFeePerGas =
        Math.round((gweiMaxPriorityFeePerGas + priorityFeePerGas) * 100) / 100;

      const newMaxPriorityFeePerGas = parseGasFeeParam(
        gweiToWei(newGweiMaxPriorityFeePerGas)
      );

      if (newMaxPriorityFeePerGas.amount < 0) return;

      setCustomMaxPriorityFee(newMaxPriorityFeePerGas?.gwei || 0);

      const newGasParams = {
        ...selectedGasFee.gasFeeParams,
        maxPriorityFeePerGas: newMaxPriorityFeePerGas,
      };
      updateToCustomGasFee(newGasParams);
    },
    [selectedGasFee.gasFeeParams, updateToCustomGasFee]
  );

  const updateFeePerGas = useCallback(
    feePerGas => {
      const maxFeePerGas =
        selectedGasFee?.gasFeeParams?.maxFeePerGas?.gwei ?? 0;

      const newGweiMaxFeePerGas = toFixedDecimals(
        add(maxFeePerGas, feePerGas),
        0
      );

      const newMaxFeePerGas = parseGasFeeParam(gweiToWei(newGweiMaxFeePerGas));

      if (newMaxFeePerGas.amount < 0) return;

      setCustomMaxBaseFee(newMaxFeePerGas?.gwei);

      const newGasParams = {
        ...selectedGasFee.gasFeeParams,
        maxFeePerGas: newMaxFeePerGas,
      };
      updateToCustomGasFee(newGasParams);
    },
    [selectedGasFee.gasFeeParams, updateToCustomGasFee]
  );

  const addMinerTip = useCallback(() => {
    updatePriorityFeePerGas(calculateMinerTipAddDifference(maxPriorityFee));
  }, [maxPriorityFee, updatePriorityFeePerGas]);

  const substMinerTip = useCallback(() => {
    updatePriorityFeePerGas(-calculateMinerTipSubstDifference(maxPriorityFee));
  }, [maxPriorityFee, updatePriorityFeePerGas]);

  const addMaxFee = useCallback(() => {
    updateFeePerGas(GAS_FEE_INCREMENT);
  }, [updateFeePerGas]);

  const substMaxFee = useCallback(() => updateFeePerGas(-GAS_FEE_INCREMENT), [
    updateFeePerGas,
  ]);

  const onMaxBaseFeeChange = useCallback(
    ({ nativeEvent: { text } }) => {
      const maxFeePerGasGwei = toFixedDecimals(text || 0, 0);
      const maxFeePerGas = parseGasFeeParam(gweiToWei(maxFeePerGasGwei));

      if (greaterThan(0, maxFeePerGas.amount)) return;

      setCustomMaxBaseFee(text);

      const newGasParams = {
        ...selectedGasFee.gasFeeParams,
        maxFeePerGas,
      };
      updateToCustomGasFee(newGasParams);
    },
    [selectedGasFee.gasFeeParams, updateToCustomGasFee]
  );

  const onMinerTipChange = useCallback(
    ({ nativeEvent: { text } }) => {
      const maxPriorityFeePerGasGwei =
        Math.round(Number(text) * 100) / 100 || 0;

      const maxPriorityFeePerGas = parseGasFeeParam(
        gweiToWei(maxPriorityFeePerGasGwei)
      );

      if (greaterThan(0, maxPriorityFeePerGas.amount)) return;

      // we don't use the round number here, if we did
      // when users type "1." it will default to "1"
      setCustomMaxPriorityFee(text);

      const newGasParams = {
        ...selectedGasFee.gasFeeParams,
        maxPriorityFeePerGas,
      };
      updateToCustomGasFee(newGasParams);
    },
    [selectedGasFee.gasFeeParams, updateToCustomGasFee]
  );

  const renderWarning = useCallback(
    (error, warning) => {
      if (!selectedOptionIsCustom) return;
      return (
        (error && (
          <View style={{ position: 'absolute' }}>
            <PanelError>{error}</PanelError>
          </View>
        )) ||
        (warning && (
          <View style={{ position: 'absolute' }}>
            <PanelWarning>{warning}</PanelWarning>
          </View>
        ))
      );
    },
    [selectedOptionIsCustom]
  );

  useEffect(() => {
    stopBaseFeeTimeout();
    startBaseFeeTimeout(() => {
      // validate not zero
      if (!maxBaseFee || isZero(maxBaseFee)) {
        setMaxBaseFeeError('1 Gwei to avoid failure');
      } else {
        setMaxBaseFeeError(null);
      }
      if (
        greaterThan(multiply(MAX_BASE_FEE_RANGE[0], currentBaseFee), maxBaseFee)
      ) {
        setMaxBaseFeeWarning('Lower than recommended');
      } else if (
        greaterThan(maxBaseFee, multiply(MAX_BASE_FEE_RANGE[1], currentBaseFee))
      ) {
        setMaxBaseFeeWarning('Higher than necessary');
      } else {
        setMaxBaseFeeWarning(null);
      }
    }, 200);
  }, [maxBaseFee, currentBaseFee, stopBaseFeeTimeout, startBaseFeeTimeout]);

  useEffect(() => {
    stopPriorityFeeTimeout();
    startPriorityFeeTimeout(() => {
      // validate not zero
      if (!maxPriorityFee || isZero(maxPriorityFee)) {
        setMaxPriorityFeeError('1 Gwei to avoid failure');
      } else {
        setMaxPriorityFeeError(null);
      }
      if (
        greaterThan(
          multiply(
            MINER_TIP_RANGE[0],
            gasFeeParamsBySpeed?.normal?.maxPriorityFeePerGas?.gwei
          ),
          maxPriorityFee
        )
      ) {
        setMaxPriorityFeeWarning('Lower than recommended');
      } else if (
        greaterThan(
          maxPriorityFee,
          multiply(
            MINER_TIP_RANGE[1],
            gasFeeParamsBySpeed?.urgent?.maxPriorityFeePerGas?.gwei
          )
        )
      ) {
        setMaxPriorityFeeWarning('Higher than necessary');
      } else {
        setMaxPriorityFeeWarning(null);
      }
    }, 200);
  }, [
    gasFeeParamsBySpeed?.urgent?.maxPriorityFeePerGas?.gwei,
    gasFeeParamsBySpeed?.normal?.maxPriorityFeePerGas?.gwei,
    maxPriorityFee,
    stopPriorityFeeTimeout,
    startPriorityFeeTimeout,
  ]);

  useEffect(() => {
    setTimeout(() => {
      maxBaseFeeInputRef?.current?.focus();
    }, 400);
  }, []);

  return (
    <Wrapper>
      <PanelRowThin>
        <PanelColumn />
        <PanelColumn>
          <GasTrendHeader color={gasUtils.GAS_TRENDS[currentGasTrend].color}>
            {gasUtils.GAS_TRENDS[currentGasTrend].label}
          </GasTrendHeader>
        </PanelColumn>
      </PanelRowThin>

      <PanelRow justify="space-between" marginBottom={18}>
        {renderRowLabel(
          'Current Base Fee',
          'currentBaseFee' + upperFirst(currentGasTrend)
        )}
        <PanelColumn>
          <PanelLabel>{formattedBaseFee}</PanelLabel>
        </PanelColumn>
      </PanelRow>

      <MiddlePanelRow>
        {renderRowLabel(
          'Max Base Fee',
          'maxBaseFee',
          maxBaseFeeError,
          maxBaseFeeWarning
        )}
        <PanelColumn>
          <FeesGweiInput
            buttonColor={colorForAsset}
            inputRef={maxBaseFeeInputRef}
            minusAction={substMaxFee}
            onChange={onMaxBaseFeeChange}
            onPress={handleFeesGweiInputFocus}
            plusAction={addMaxFee}
            testID="max-base-fee-input"
            value={maxBaseFee}
          />
        </PanelColumn>
      </MiddlePanelRow>
      <Row>{renderWarning(maxBaseFeeError, maxBaseFeeWarning)}</Row>

      <MiddlePanelRow>
        {renderRowLabel(
          'Miner Tip',
          `minerTip`,
          maxPriorityFeeError,
          maxPriorityFeeWarning
        )}
        <PanelColumn>
          <FeesGweiInput
            buttonColor={colorForAsset}
            minusAction={substMinerTip}
            onChange={onMinerTipChange}
            onPress={handleCustomPriorityFeeFocus}
            plusAction={addMinerTip}
            testID="max-priority-fee-input"
            value={maxPriorityFee}
          />
        </PanelColumn>
      </MiddlePanelRow>
      <Row>{renderWarning(maxPriorityFeeError, maxPriorityFeeWarning)}</Row>

      <PanelRow marginTop={18}>
        <PanelColumn>
          <PanelLabel>Max Transaction Fee</PanelLabel>
        </PanelColumn>
        <PanelColumn>
          <PanelLabel>{maxFee}</PanelLabel>
        </PanelColumn>
      </PanelRow>
    </Wrapper>
  );
}
