'use strict'

const { ZigBeeLightDevice } = require('homey-zigbeedriver')
const { debug, CLUSTER } = require('zigbee-clusters')

class Device extends ZigBeeLightDevice {

  async onNodeInit({
    zclNode,
    supportsHueAndSaturation,
    supportsColorTemperature
  }) {
    await super.onNodeInit({
      zclNode,
      supportsHueAndSaturation,
      supportsColorTemperature
    })

    debug(true)
    this.enableDebug()
    this.printNode()

    this._setUpOnOffReport()
    this._setUpDimReport()

    this._setUpMeterPowerMeasurePower().catch(this.error)
  }

  _setUpOnOffReport() {

    if (this.hasCapability('onoff')) {
      this.zclNode.endpoints[1].clusters.onOff.on('attr.onOff', async value => {
        const oldValue = await this.getCapabilityValue('onoff')
        if (value === oldValue) {
          console.log(`attr.onOff old value, ignore`, value)
        } else {
          console.log(`attr.onOff new value`, value)
          await this.setCapabilityValue('onoff', value)
            .catch(this.error)
        }
      })
    }
  }

  _setUpDimReport() {

    if (this.hasCapability('dim')) {
      this.zclNode.endpoints[1].clusters.levelControl.on('attr.currentLevel', async value => {
        const oldValue = await this.getCapabilityValue('dim')
        const diff = Math.abs(oldValue * 254 - value)
        console.log(`attr.currentLevel oldValue newValue diff`, oldValue, value, diff)
        if (diff >= 5) {
          let newValue = parseFloat((value / 0xFE).toFixed(2))
          await this.setCapabilityValue('dim', newValue).catch(this.error)
        }
      })
    }
  }

  async _setUpMeterPowerMeasurePower () {

    if (this.hasCapability('meter_power')) {

      const meterFactory = 1.0 / 3600000.0

      this.registerCapability('meter_power', CLUSTER.METERING, {
        get: 'currentSummationDelivered',
        report: 'currentSummationDelivered',
        reportOpts: {
          configureAttributeReporting: {
            minInterval: 0,
            maxInterval: 3600,
            minChange: 0.2 / meterFactory,
          },
        },
        reportParser: async value => {
          const result = value * meterFactory
          this.log(`currentSummationDelivered report`, value, result)
          return result
        },
        getOpts: {
          getOnStart: true,
          pollInterval: 60 * 60 * 1000,
        }
      })
    }

    if (this.hasCapability('measure_power')) {

      const measureFactory = 0.1

      this.registerCapability('measure_power', CLUSTER.ELECTRICAL_MEASUREMENT, {
        get: 'activePower',
        report: 'activePower',
        reportOpts: {
          configureAttributeReporting: {
            minInterval: 0,
            maxInterval: 3600,
            minChange: 0.5 / measureFactory,
          },
        },
        reportParser: async value => {
          const result = value * measureFactory
          this.log(`activePower report`, value, result)
          return result
        },
        getOpts: {
          getOnStart: true,
          pollInterval: 60 * 60 * 1000,
        }
      })
    }
  }

}

module.exports = Device
