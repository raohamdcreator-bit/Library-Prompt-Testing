import React from 'react';
import PropTypes from 'prop-types';
import './PromptList.css';

const PromptList = ({ prompts }) => {
    return (
        <div className="prompt-list">
            <h2>Prompts</h2>
            <ul>
                {prompts.map((prompt, index) => (
                    <li key={index} className="prompt-item">
                        {prompt}
                    </li>
                ))}
            </ul>
        </div>
    );
};

PromptList.propTypes = {
    prompts: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default PromptList;