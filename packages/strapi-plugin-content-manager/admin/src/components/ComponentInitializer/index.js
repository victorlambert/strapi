import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import pluginId from '../../pluginId';
import useDataManager from '../../hooks/useDataManager';
import NonRepeatableWrapper from '../NonRepeatableWrapper';
import PlusButton from '../PlusButton';
import P from './P';

const ComponentInitializer = ({ name }) => {
  const { addNonRepeatableComponentToField } = useDataManager();

  return (
    <NonRepeatableWrapper isEmpty>
      {/* <div /> */}
      <PlusButton
        onClick={() => addNonRepeatableComponentToField(name, false)}
        type="button"
      />
      <FormattedMessage id={`${pluginId}.components.empty-repeatable`}>
        {msg => <P style={{ paddingTop: 75 }}>{msg}</P>}
      </FormattedMessage>
    </NonRepeatableWrapper>
  );
};

ComponentInitializer.defaultProps = {
  name: '',
};

ComponentInitializer.propTypes = {
  name: PropTypes.string,
};

export default ComponentInitializer;
