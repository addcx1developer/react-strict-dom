/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 */

import type { StrictProps } from '../../types/StrictProps';

import * as React from 'react';
import { Animated, Pressable } from 'react-native';
import { View } from '../react-native';

import { ProvideCustomProperties } from './ContextCustomProperties';
import { ProvideDisplayInside, useDisplayInside } from './ContextDisplayInside';
import { ProvideInheritedStyles } from './ContextInheritedStyles';
import { TextString } from './TextString';
import { warnMsg } from '../../shared/logUtils';
import { mergeRefs } from '../../shared/mergeRefs';
import { useNativeProps } from './useNativeProps';
import { useStrictDOMElement } from './useStrictDOMElement';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function createStrictDOMComponent<T, P: StrictProps>(
  tagName: string,
  defaultProps?: P
): React.AbstractComponent<P, T> {
  const component: React.AbstractComponent<P, T> = React.forwardRef(
    function (props, forwardedRef) {
      let NativeComponent = tagName === 'button' ? Pressable : View;
      const elementRef = useStrictDOMElement<T>({ tagName });

      /**
       * Resolve global HTML and style props
       */

      const { customProperties, nativeProps, inheritableStyle } =
        useNativeProps(defaultProps, props, {
          provideInheritableStyle:
            tagName !== 'br' || tagName !== 'hr' || tagName !== 'option',
          withInheritedStyle: false,
          withTextStyle: false
        });

      if (nativeProps.onPress != null && NativeComponent === View) {
        NativeComponent = Pressable;
      }

      // Tag-specific props

      if (tagName === 'header') {
        nativeProps.role = nativeProps.role ?? 'header';
      }

      // Component-specific props

      if (NativeComponent === Pressable) {
        if (props.disabled === true) {
          nativeProps.disabled = true;
          nativeProps.focusable = false;
        }
      }

      nativeProps.ref = React.useMemo(
        () => mergeRefs(elementRef, forwardedRef),
        [elementRef, forwardedRef]
      );

      // Workaround: React Native doesn't support raw text children of View
      // Sometimes we can auto-fix this
      if (typeof nativeProps.children === 'string') {
        nativeProps.children = <TextString children={nativeProps.children} />;
      }

      // Polyfill for default of "display:block"
      // which implies "displayInside:flow"
      let nextDisplayInsideValue = 'flow';
      const displayInsideValue = useDisplayInside();
      const displayValue = nativeProps.style.display;
      if (
        displayValue != null &&
        displayValue !== 'flex' &&
        displayValue !== 'none' &&
        displayValue !== 'block'
      ) {
        if (__DEV__) {
          warnMsg(
            `unsupported style value in "display:${String(displayValue)}"`
          );
        }
      }

      if (displayValue === 'flex') {
        nextDisplayInsideValue = 'flex';
        nativeProps.style.alignItems ??= 'stretch';
        nativeProps.style.flexBasis ??= 'auto';
        nativeProps.style.flexDirection ??= 'row';
        nativeProps.style.flexShrink ??= 1;
        nativeProps.style.flexWrap ??= 'nowrap';
        nativeProps.style.justifyContent ??= 'flex-start';
      } else if (displayValue === 'block' && displayInsideValue === 'flow') {
        // Force the block emulation styles
        nextDisplayInsideValue = 'flow';
        nativeProps.style.alignItems = 'stretch';
        nativeProps.style.display = 'flex';
        nativeProps.style.flexBasis = 'auto';
        nativeProps.style.flexDirection = 'column';
        nativeProps.style.flexShrink = 0;
        nativeProps.style.flexWrap = 'nowrap';
        nativeProps.style.justifyContent = 'flex-start';
      }

      if (displayInsideValue === 'flex') {
        // flex child should not shrink
        nativeProps.style.flexShrink ??= 1;
      }

      // Use Animated components if necessary
      if (nativeProps.animated === true) {
        if (NativeComponent === View) {
          NativeComponent = Animated.View;
        }
        if (NativeComponent === Pressable) {
          NativeComponent = AnimatedPressable;
        }
      }

      /**
       * Construct tree
       */

      if (NativeComponent === View) {
        // enable W3C flexbox layout
        nativeProps.experimental_layoutConformance = 'strict';
      }

      // $FlowFixMe
      let element = React.createElement(NativeComponent, nativeProps);

      if (
        nativeProps.children != null &&
        typeof nativeProps.children !== 'string'
      ) {
        if (inheritableStyle != null) {
          element = (
            <ProvideInheritedStyles
              children={element}
              value={inheritableStyle}
            />
          );
        }
        if (nextDisplayInsideValue !== displayInsideValue) {
          element = (
            <ProvideDisplayInside
              children={element}
              value={nextDisplayInsideValue}
            />
          );
        }
        if (customProperties != null) {
          element = (
            <ProvideCustomProperties
              children={element}
              value={customProperties}
            />
          );
        }
      }

      return element;
    }
  );

  component.displayName = `html.${tagName}`;
  return component;
}
