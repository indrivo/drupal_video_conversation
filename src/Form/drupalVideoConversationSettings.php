<?php

namespace Drupal\drupal_video_conversation\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Basic video monitoring configuration form.
 */
class drupalVideoConversationSettings extends ConfigFormBase {

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'drupal_video_conversation_config_form';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {

    $form = parent::buildForm($form, $form_state);
    $config = $this->config('drupal_video_conversation.settings');

    $form['video_expiry_days'] = [
      '#type'          => 'textfield',
      '#title'         => $this->t('Video expiry days'),
      '#description'   => $this->t('The number of days after which the video will be set as expired.'),
      '#default_value' => $config->get('video_expiry_days') ?? 20,
      '#required'      => TRUE,
    ];

    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $config = $this->config('drupal_video_conversation.settings');
    $config->set('video_expiry_days', $form_state->getValue('video_expiry_days', 20));
    $config->save();

    return parent::submitForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames() {
    return ['drupal_video_conversation.settings'];
  }

}
