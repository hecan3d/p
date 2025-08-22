(function(Scratch) {
    'use strict';
    
    class DaydreamController {
        constructor() {
            this.device = null;
            this.connected = false;
            this.characteristic = null;
            
            // Константы из статьи
            this.DAYDREAM_SERVICE = '0000fe55-0000-1000-8000-00805f9b34fb';
            this.DAYDREAM_CHARACTERISTIC = '00000001-1000-1000-8000-00805f9b34fb';
            this.CCC_DESCRIPTOR = '00002902-0000-1000-8000-00805f9b34fb';
            
            // Константы кнопок
            this.CLICK_BTN = 0x1;
            this.HOME_BTN = 0x2;
            this.APP_BTN = 0x4;
            this.VOL_DOWN_BTN = 0x8;
            this.VOL_UP_BTN = 0x10;
            
            // Состояние контроллера
            this.buttons = {
                click: false,
                home: false,
                app: false,
                volumeDown: false,
                volumeUp: false
            };
            
            this.orientation = { x: 0, y: 0, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            this.gyro = { x: 0, y: 0, z: 0 };
            this.touchpad = { x: 0, y: 0 };
            
            this.sequence = 0;
            this.timestamp = 0;
            
            this.rawData = new Uint8Array(20);
        }
        
        getInfo() {
            return {
                id: 'daydream',
                name: 'Google Daydream',
                color1: '#4285F4',
                color2: '#3367D6',
                blocks: [
                    {
                        opcode: 'connect',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'подключить Daydream контроллер'
                    },
                    {
                        opcode: 'disconnect',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'отключить контроллер'
                    },
                    {
                        opcode: 'isConnected',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'контроллер подключен?'
                    },
                    {
                        opcode: 'getButton',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'кнопка [BUTTON] нажата?',
                        arguments: {
                            BUTTON: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'buttons'
                            }
                        }
                    },
                    {
                        opcode: 'getTouchpadX',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'тачпад X (-100 до 100)'
                    },
                    {
                        opcode: 'getTouchpadY',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'тачпад Y (-100 до 100)'
                    },
                    {
                        opcode: 'getTouchpadXRaw',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'тачпад X (0 до 1)'
                    },
                    {
                        opcode: 'getTouchpadYRaw',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'тачпад Y (0 до 1)'
                    },
                    {
                        opcode: 'getOrientation',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'ориентация [AXIS]',
                        arguments: {
                            AXIS: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'orientationAxes'
                            }
                        }
                    },
                    {
                        opcode: 'getAcceleration',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'ускорение [AXIS]',
                        arguments: {
                            AXIS: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'accelerationAxes'
                            }
                        }
                    },
                    {
                        opcode: 'getGyro',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'гироскоп [AXIS]',
                        arguments: {
                            AXIS: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'gyroAxes'
                            }
                        }
                    },
                    {
                        opcode: 'getSequence',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'последовательность'
                    },
                    {
                        opcode: 'getTimestamp',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'время'
                    },
                    {
                        opcode: 'resetOrientation',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'сбросить ориентацию'
                    },
                    {
                        opcode: 'setDeadzone',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'установить мертвую зону [VALUE]%',
                        arguments: {
                            VALUE: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: '10'
                            }
                        }
                    },
                    {
                        opcode: 'getRawByte',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'байт [INDEX]',
                        arguments: {
                            INDEX: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: '0'
                            }
                        }
                    }
                ],
                menus: {
                    buttons: {
                        acceptReporters: true,
                        items: [
                            'click',
                            'home', 
                            'app',
                            'volume down',
                            'volume up'
                        ]
                    },
                    orientationAxes: {
                        acceptReporters: true,
                        items: ['X', 'Y', 'Z']
                    },
                    accelerationAxes: {
                        acceptReporters: true,
                        items: ['X', 'Y', 'Z']
                    },
                    gyroAxes: {
                        acceptReporters: true,
                        items: ['X', 'Y', 'Z']
                    }
                }
            };
        }
        
        async connect() {
            if (!navigator.bluetooth) {
                alert('Web Bluetooth API не поддерживается. Используйте Chrome или Edge.');
                return;
            }
            
            try {
                console.log('Поиск Daydream контроллера...');
                
                this.device = await navigator.bluetooth.requestDevice({
                    filters: [
                        { name: 'Daydream controller' },
                        { name: 'Daydream' },
                        { services: [this.DAYDREAM_SERVICE] }
                    ],
                    optionalServices: [this.DAYDREAM_SERVICE]
                });
                
                if (!this.device) {
                    console.log('Устройство не выбрано');
                    return;
                }
                
                console.log('Найдено:', this.device.name);
                
                const server = await this.device.gatt.connect();
                console.log('Подключено к GATT серверу');
                
                // Получаем сервис
                const service = await server.getPrimaryService(this.DAYDREAM_SERVICE);
                console.log('Сервис найден');
                
                // Получаем характеристику
                this.characteristic = await service.getCharacteristic(this.DAYDREAM_CHARACTERISTIC);
                console.log('Характеристика найдена');
                
                // Включаем уведомления
                await this.characteristic.startNotifications();
                this.characteristic.addEventListener('characteristicvaluechanged', 
                    (event) => this._handleData(event));
                
                // Устанавливаем дескриптор для уведомлений
                try {
                    const descriptor = await this.characteristic.getDescriptor(this.CCC_DESCRIPTOR);
                    const enableNotifications = new Uint8Array([0x01, 0x00]);
                    await descriptor.writeValue(enableNotifications);
                    console.log('Уведомления включены');
                } catch (error) {
                    console.warn('Не удалось установить дескриптор, но продолжаем:', error);
                }
                
                this.connected = true;
                console.log('Контроллер подключен успешно!');
                
            } catch (error) {
                console.error('Ошибка подключения:', error);
                alert('Ошибка: ' + error.message);
            }
        }
        
        disconnect() {
            if (this.device && this.device.gatt.connected) {
                this.device.gatt.disconnect();
            }
            this.connected = false;
            this.device = null;
            this.characteristic = null;
            console.log('Отключено');
        }
        
        _handleData(event) {
            const value = event.target.value;
            if (!value || value.byteLength < 20) return;
            
            // Сохраняем сырые данные
            this.rawData = new Uint8Array(value.buffer);
            
            // Парсим данные согласно Android примеру из статьи
            this._parseData(this.rawData);
        }
        
        _parseData(data) {
            // Кнопки (байт 18)
            this.buttons.click = (data[18] & this.CLICK_BTN) !== 0;
            this.buttons.home = (data[18] & this.HOME_BTN) !== 0;
            this.buttons.app = (data[18] & this.APP_BTN) !== 0;
            this.buttons.volumeDown = (data[18] & this.VOL_DOWN_BTN) !== 0;
            this.buttons.volumeUp = (data[18] & this.VOL_UP_BTN) !== 0;
            
            // Время (байты 0-1)
            this.timestamp = ((data[0] & 0xFF) << 1) | ((data[1] & 0x80) >> 7);
            
            // Последовательность (байт 1)
            this.sequence = (data[1] & 0x7C) >> 2;
            
            // Ориентация (13-битные знаковые целые)
            this.orientation.x = this._parse13BitSigned(
                (data[1] & 0x03) << 11 | (data[2] & 0xFF) << 3 | (data[3] & 0xE0) >> 5
            );
            
            this.orientation.y = this._parse13BitSigned(
                (data[3] & 0x1F) << 8 | (data[4] & 0xFF)
            );
            
            this.orientation.z = this._parse13BitSigned(
                (data[5] & 0xFF) << 5 | (data[6] & 0xF8) >> 3
            );
            
            // Ускорение (13-битные знаковые целые)
            this.acceleration.x = this._parse13BitSigned(
                (data[6] & 0x07) << 10 | (data[7] & 0xFF) << 2 | (data[8] & 0xC0) >> 6
            );
            
            this.acceleration.y = this._parse13BitSigned(
                (data[8] & 0x3F) << 7 | (data[9] & 0xFE) >> 1
            );
            
            this.acceleration.z = this._parse13BitSigned(
                (data[9] & 0x01) << 12 | (data[10] & 0xFF) << 4 | (data[11] & 0xF0) >> 4
            );
            
            // Гироскоп (13-битные знаковые целые)
            this.gyro.x = this._parse13BitSigned(
                (data[11] & 0x0F) << 9 | (data[12] & 0xFF) << 1 | (data[13] & 0x80) >> 7
            );
            
            this.gyro.y = this._parse13BitSigned(
                (data[13] & 0x7F) << 6 | (data[14] & 0xFC) >> 2
            );
            
            this.gyro.z = this._parse13BitSigned(
                (data[14] & 0x03) << 11 | (data[15] & 0xFF) << 3 | (data[16] & 0xE0) >> 5
            );
            
            // Тачпад (байты 16-17) - сохраняем сырые значения 0-1
            const rawX = ((data[16] & 0x1F) << 3 | (data[17] & 0xE0) >> 5) / 255.0;
            const rawY = ((data[17] & 0x1F) << 3 | (data[18] & 0xE0) >> 5) / 255.0;
            
            // Конвертируем в диапазон -100 до 100
            this.touchpad.x = this._convertToRange(rawX, 0, 1, -100, 100);
            this.touchpad.y = this._convertToRange(rawY, 0, 1, -100, 100);
            
            // Масштабирование значений как в Unity из статьи
            this._scaleValues();
        }
        
        _parse13BitSigned(value) {
            // Преобразование 13-битного знакового числа в 32-битное
            return (value << 19) >> 19;
        }
        
        _convertToRange(value, minIn, maxIn, minOut, maxOut) {
            // Конвертация значения из одного диапазона в другой
            return ((value - minIn) / (maxIn - minIn)) * (maxOut - minOut) + minOut;
        }
        
        _scaleValues() {
            // Масштабирование значений как в Unity из статьи
            const oriVector = this.orientation;
            const accVector = this.acceleration;
            const gyroVector = this.gyro;
            
            // Ориентация (радианы)
            oriVector.x *= (2 * Math.PI / 4095.0);
            oriVector.y *= (2 * Math.PI / 4095.0);
            oriVector.z *= (2 * Math.PI / 4095.0);
            
            // Ускорение (g-force)
            accVector.x *= (8 * 9.8 / 4095.0);
            accVector.y *= (8 * 9.8 / 4095.0);
            accVector.z *= (8 * 9.8 / 4095.0);
            
            // Гироскоп (радианы/секунду)
            gyroVector.x *= (2048 / 180 * Math.PI / 4095.0);
            gyroVector.y *= (2048 / 180 * Math.PI / 4095.0);
            gyroVector.z *= (2048 / 180 * Math.PI / 4095.0);
            
            // Инвертируем X и Y для ориентации (как в Unity)
            oriVector.x = -oriVector.x;
            oriVector.y = -oriVector.y;
        }
        
        setDeadzone(args) {
            // Функция для установки мертвой зоны (можно доработать)
            const deadzone = Math.max(0, Math.min(50, Number(args.VALUE) || 10));
            console.log('Мертвая зона установлена на:', deadzone + '%');
        }
        
        resetOrientation() {
            // Сброс ориентации (как в статье при удержании Home)
            this.orientation.x = 0;
            this.orientation.y = 0;
            this.orientation.z = 0;
            console.log('Ориентация сброшена');
        }
        
        isConnected() {
            return this.connected;
        }
        
        getButton(args) {
            const buttonMap = {
                'click': 'click',
                'home': 'home', 
                'app': 'app',
                'volume down': 'volumeDown',
                'volume up': 'volumeUp'
            };
            
            const buttonName = buttonMap[args.BUTTON];
            return buttonName ? this.buttons[buttonName] : false;
        }
        
        getTouchpadX() {
            // Возвращаем значение от -100 до 100
            return this.touchpad.x;
        }
        
        getTouchpadY() {
            // Возвращаем значение от -100 до 100
            return this.touchpad.y;
        }
        
        getTouchpadXRaw() {
            // Возвращаем сырое значение от 0 до 1
            return this._convertToRange(this.touchpad.x, -100, 100, 0, 1);
        }
        
        getTouchpadYRaw() {
            // Возвращаем сырое значение от 0 до 1
            return this._convertToRange(this.touchpad.y, -100, 100, 0, 1);
        }
        
        getOrientation(args) {
            return this.orientation[args.AXIS.toLowerCase()] || 0;
        }
        
        getAcceleration(args) {
            return this.acceleration[args.AXIS.toLowerCase()] || 0;
        }
        
        getGyro(args) {
            return this.gyro[args.AXIS.toLowerCase()] || 0;
        }
        
        getSequence() {
            return this.sequence;
        }
        
        getTimestamp() {
            return this.timestamp;
        }
        
        getRawByte(args) {
            const index = Math.max(0, Math.min(19, Math.floor(Number(args.INDEX) || 0)));
            return this.rawData.length > index ? this.rawData[index] : 0;
        }
    }

    Scratch.extensions.register(new DaydreamController());
})(Scratch);