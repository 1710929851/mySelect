/**
 * Custom Select Plugin
 * 
 * @example
 * // 基础用法
 * $('#mySelect').customSelect({
 *     multiple: false,
 *     placeholder: '请选择...',
 *     data: [
 *         { id: 1, text: '选项1' },
 *         { id: 2, text: '选项2' }
 *     ]
 * });
 * 
 * // 多选模式
 * $('#multiSelect').customSelect({
 *     multiple: true,
 *     maxTagCount: 3,
 *     tagMaxLength: 10,
 *     placeholder: '请选择多个选项',
 *     data: [{id: 1, text: '选项1'}, {id: 2, text: '选项2'}],
 *     onChange: function(selected) {
 *         console.log('选中的项：', selected);
 *     }
 * });
 * 
 * // DOM属性回显
 * <div id="select" value="1,2,3"></div>
 * $('#select').customSelect({...});
 * 
 * // 动态设置值
 * $('#select').data('customSelect').setValue('1,2,3');
 * 
 * // 获取当前值
 * const selectedItems = $('#select').data('customSelect').getValue();
 */

(function($) {
    // 全局默认配置
    const DEFAULTS = {
        multiple: false,
        placeholder: '请选择...',
        data: [],
        value: [],
        onChange: null,
        itemHeight: 36,
        visibleItems: 10,
        maxTagCount: Infinity,
        tagMaxLength: 15
    };

    /**
     * 快速初始化方法
     * @example
     * // 快速初始化单选
     * $('#select').initSelect(data);
     * 
     * // 快速初始化多选
     * $('#select').initMultiSelect(data);
     */
    $.fn.initSelect = function(data) {
        return this.customSelect({
            multiple: false,
            data: data
        });
    };

    $.fn.initMultiSelect = function(data) {
        return this.customSelect({
            multiple: true,
            data: data
        });
    };

    /**
     * 自定义下拉框插件
     * @param {Object} options - 配置选项
     * @param {boolean} [options.multiple=false] - 是否支持多选
     * @param {string} [options.placeholder='请选择...'] - 占位符文本
     * @param {Array<{id: number, text: string}>} options.data - 下拉选项数据
     * @param {Array<number>|number} [options.value=[]] - 初始选中值
     * @param {Function} [options.onChange=null] - 值变化时的回调函数
     * @param {number} [options.itemHeight=36] - 选项高度
     * @param {number} [options.visibleItems=10] - 可视区域显示的选项数量
     * @param {number} [options.maxTagCount=Infinity] - 最多显示多少个标签
     * @param {number} [options.tagMaxLength=15] - 标签文本最大长度
     * @returns {jQuery} jQuery对象，支持链式调用
     */
    $.fn.customSelect = function(options) {
        return this.each(function() {
            const $this = $(this);
            
            // 从data属性读取配置
            const dataOptions = {
                multiple: $this.data('multiple'),
                placeholder: $this.data('placeholder'),
                maxTagCount: $this.data('maxTagCount'),
                tagMaxLength: $this.data('tagMaxLength'),
                value: $this.attr('value')
            };

            // 合并配置优先级：用户配置 > data属性 > 默认配置
            const settings = $.extend({}, DEFAULTS, dataOptions, options);

            /**
             * 文本截断函数
             * @param {string} text - 原始文本
             * @param {number} maxLength - 最大长度
             * @returns {string} 处理后的文本
             * @private
             */
            function truncateText(text, maxLength) {
                if (text.length <= maxLength) return text;
                return text.substring(0, maxLength) + '...';
            }

            const $container = $(this);
            let selectedItems = [];
            let filteredData = settings.data; // 存储过滤后的数据
            let scrollTop = 0; // 当前滚动位置
            let renderTimer = null; // 用于节流的定时器
            
            // 新增：从DOM属性读取初始值
            const domValue = $container.attr('value');
            if (domValue) {
                if (settings.multiple) {
                    settings.value = domValue.split(',').map(v => parseInt(v, 10));
                } else {
                    settings.value = parseInt(domValue, 10);
                }
            }
            
            // 创建基础结构
            const $select = $('<div class="custom-select">');
            const $input = $('<div class="select-input">');
            const $dropdown = $('<div class="select-dropdown">');
            const $search = $('<div class="select-search"><input type="text" placeholder="搜索..."></div>');
            const $options = $('<ul class="select-options">');
            const $clear = $('<span class="clear-button">×</span>');
            const $arrow = $('<span class="select-arrow">▼</span>');
            
            // 组装DOM
            $select.append($input, $arrow, $clear, $dropdown);
            $dropdown.append($search, $options);
            $container.append($select);

            // 修改：计算虚拟滚动相关参数
            function calculateVirtualScroll() {
                const scrollTop = $options.scrollTop();
                const startIndex = Math.floor(scrollTop / settings.itemHeight);
                const visibleCount = Math.ceil($options.height() / settings.itemHeight) + 1;
                const bufferSize = Math.floor(visibleCount / 2);
                
                const start = Math.max(0, startIndex - bufferSize);
                const end = Math.min(filteredData.length, startIndex + visibleCount + bufferSize);
                
                return {
                    totalHeight: filteredData.length * settings.itemHeight,
                    startIndex: start,
                    visibleData: filteredData.slice(start, end),
                    topPadding: start * settings.itemHeight
                };
            }

            // 修改：渲染选项函数
            function renderOptions() {
                const { totalHeight, startIndex, visibleData, topPadding } = calculateVirtualScroll();
                
                const optionsHtml = visibleData.map(item => {
                    const isSelected = selectedItems.find(selected => selected.id === item.id);
                    return `<li class="select-option${isSelected ? ' selected' : ''}" 
                        data-id="${item.id}" 
                        data-text="${item.text}"
                        style="height: ${settings.itemHeight}px; line-height: ${settings.itemHeight - 16}px;">${item.text}</li>`;
                }).join('');

                // 更新DOM
                const currentScrollTop = $options.scrollTop();
                
                $options.html(`
                    <div style="height: ${totalHeight}px; position: relative;">
                        <div style="position: absolute; top: ${topPadding}px; width: 100%;">
                            ${optionsHtml}
                        </div>
                    </div>
                `);

                $options.scrollTop(currentScrollTop);
            }

            // 修改：滚动处理优化
            $options.on('scroll', function() {
                if (renderTimer) {
                    window.cancelAnimationFrame(renderTimer);
                }
                renderTimer = window.requestAnimationFrame(renderOptions);
            });

            // 修改：CSS样式设置
            $options.css({
                padding: 0,
                margin: 0,
                listStyle: 'none',
                height: 'calc(100% - 50px)', // 减去搜索框高度
                overflowY: 'auto',
                overflowX: 'hidden'
            });

            // 修改：搜索处理函数
            let searchTimer = null;
            $search.find('input').on('input', function() {
                if (searchTimer) {
                    clearTimeout(searchTimer);
                }
                
                searchTimer = setTimeout(() => {
                    const searchText = $(this).val().toLowerCase();
                    filteredData = settings.data.filter(item => 
                        item.text.toLowerCase().includes(searchText)
                    );
                    $options.scrollTop(0);
                    requestAnimationFrame(renderOptions);
                }, 100);
            });

            // 修改：初始化渲染
            function initializeOptions() {
                filteredData = settings.data;
                requestAnimationFrame(renderOptions);
            }

            // 初始化
            initializeOptions();

            // 新增：创建隐藏的input元素用于表单提交
            const name = $container.attr('name') || '';
            if (name) {
                const $hiddenInput = $(`<input type="hidden" name="${name}">`);
                $container.append($hiddenInput);
            }

            // 修改：更新选中项显示函数，同时更新隐藏input的值
            function updateSelection() {
                if (settings.multiple) {
                    const $selectedItems = $('<div class="selected-items">');
                    
                    // 处理标签显示逻辑
                    const displayTags = selectedItems.slice(0, settings.maxTagCount);
                    const remainingCount = selectedItems.length - displayTags.length;
                    
                    // 渲染可见标签
                    displayTags.forEach(item => {
                        const truncatedText = truncateText(item.text, settings.tagMaxLength);
                        const $tag = $(`
                            <span class="selected-tag" data-id="${item.id}" title="${item.text}">
                                ${truncatedText}
                                <span class="remove-tag">×</span>
                            </span>
                        `);
                        $selectedItems.append($tag);
                    });

                    // 如果有剩余标签，添加计数标签
                    if (remainingCount > 0) {
                        const $countTag = $(`
                            <span class="selected-tag count-tag" title="${selectedItems.slice(settings.maxTagCount).map(item => item.text).join(', ')}">
                                +${remainingCount}
                            </span>
                        `);
                        $selectedItems.append($countTag);
                    }

                    $input.html(selectedItems.length ? $selectedItems : settings.placeholder);

                    // 更新隐藏input的值
                    if (name) {
                        const value = selectedItems.map(item => item.id).join(',');
                        $container.find(`input[name="${name}"]`).val(value);
                    }
                } else {
                    // 单选模式也应用文本截断
                    const text = selectedItems.length ? selectedItems[0].text : settings.placeholder;
                    const truncatedText = truncateText(text, settings.tagMaxLength);
                    $input.attr('title', text).text(truncatedText);

                    // 更新隐藏input的值
                    if (name) {
                        const value = selectedItems[0]?.id || '';
                        $container.find(`input[name="${name}"]`).val(value);
                    }
                }
                
                $clear.toggle(selectedItems.length > 0);
            }

            // 事件处理
            $input.on('click', function() {
                $dropdown.toggle();
                $input.toggleClass('active');
                $arrow.toggleClass('active');
                
                // 新增：展开时立即渲染
                if ($dropdown.is(':visible')) {
                    $search.find('input').val('');
                    // 重置过滤数据
                    filteredData = settings.data;
                    // 重置滚动位置
                    $options.scrollTop(0);
                    // 立即渲染
                    requestAnimationFrame(() => {
                        renderOptions();
                        // 如果有选中项，滚动到第一个选中项
                        if (selectedItems.length > 0) {
                            const firstSelectedId = selectedItems[0].id;
                            const selectedIndex = filteredData.findIndex(item => item.id === firstSelectedId);
                            if (selectedIndex > -1) {
                                $options.scrollTop(selectedIndex * settings.itemHeight);
                            }
                        }
                    });
                }
            });

            $options.on('click', '.select-option', function(e) {
                // 阻止事件冒泡，防止触发外部点击事件
                e.stopPropagation();
                
                const $option = $(this);
                const id = $option.data('id');
                const text = $option.data('text');
                
                if (settings.multiple) {
                    const index = selectedItems.findIndex(item => item.id === id);
                    if (index === -1) {
                        selectedItems.push({ id, text });
                    } else {
                        selectedItems.splice(index, 1);
                    }
                    // 多选模式下只更新选中状态，不关闭下拉框
                    updateSelection();
                    renderOptions();
                } else {
                    // 单选模式下选择后关闭下拉框
                    selectedItems = [{ id, text }];
                    $dropdown.hide();
                    $input.removeClass('active');
                    $arrow.removeClass('active');
                    updateSelection();
                    renderOptions();
                }
                
                if (settings.onChange) {
                    settings.onChange(selectedItems);
                }
            });

            $input.on('click', '.remove-tag', function(e) {
                e.stopPropagation();
                const id = $(this).parent().data('id');
                selectedItems = selectedItems.filter(item => item.id !== id);
                updateSelection();
                renderOptions();
            });

            $clear.on('click', function(e) {
                e.stopPropagation();
                selectedItems = [];
                updateSelection();
                renderOptions();
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('.custom-select').length) {
                    $dropdown.hide();
                    $input.removeClass('active');
                    $arrow.removeClass('active');
                }
            });

            /**
             * 设置选中值
             * @param {string|number|Array} values - 要设置的值
             * @public
             */
            function setValue(values) {
                if (typeof values === 'string') {
                    values = settings.multiple ? 
                        values.split(',').map(v => parseInt(v, 10)) : 
                        parseInt(values, 10);
                }
                
                if (!Array.isArray(values)) {
                    values = [values];
                }
                
                selectedItems = values.map(val => {
                    const item = settings.data.find(d => d.id === val);
                    // 确保text值的清洁
                    return item ? { 
                        id: item.id, 
                        text: item.text.trim() 
                    } : null;
                }).filter(item => item !== null);

                if (!settings.multiple && selectedItems.length > 1) {
                    selectedItems = selectedItems.slice(0, 1);
                }

                // 更新DOM属性值
                $container.attr('value', settings.multiple ? 
                    selectedItems.map(item => item.id).join(',') : 
                    selectedItems[0]?.id || '');

                updateSelection();
                renderOptions();
                
                if (settings.onChange) {
                    settings.onChange(selectedItems);
                }
            }

            /**
             * 获取当前选中值
             * @returns {Array<{id: number, text: string}>} 当前选中的项
             * @public
             */
            function getValue() {
                return selectedItems;
            }

            // 初始化时设置初始值
            if (settings.value && (Array.isArray(settings.value) ? settings.value.length : true)) {
                setValue(settings.value);
            }

            // 添加快捷方法
            const api = {
                setValue,
                getValue,
                clear: function() {
                    setValue([]);
                },
                destroy: function() {
                    $container.remove();
                    $this.removeData('customSelect');
                },
                refresh: function() {
                    renderOptions();
                },
                enable: function() {
                    $select.removeClass('disabled');
                    $input.prop('disabled', false);
                },
                disable: function() {
                    $select.addClass('disabled');
                    $input.prop('disabled', true);
                }
            };

            // 挂载API
            $this.data('customSelect', api);

            // 修改搜索框点击事件，防止关闭下拉框
            $search.on('click', function(e) {
                e.stopPropagation();
            });

            // 修改搜索输入框点击事件，防止关闭下拉框
            $search.find('input').on('click', function(e) {
                e.stopPropagation();
            });

            // 修改下拉框点击事件，防止关闭
            $dropdown.on('click', function(e) {
                e.stopPropagation();
            });

            // 修改：添加箭头点击事件
            $arrow.on('click', function(e) {
                e.stopPropagation(); // 阻止事件冒泡
                // 触发与输入框相同的展开/收起逻辑
                $dropdown.toggle();
                $input.toggleClass('active');
                $arrow.toggleClass('active');
                
                // 展开时的处理逻辑
                if ($dropdown.is(':visible')) {
                    $search.find('input').val('');
                    // 重置过滤数据
                    filteredData = settings.data;
                    // 重置滚动位置
                    $options.scrollTop(0);
                    // 立即渲染
                    requestAnimationFrame(() => {
                        renderOptions();
                        // 如果有选中项，滚动到第一个选中项
                        if (selectedItems.length > 0) {
                            const firstSelectedId = selectedItems[0].id;
                            const selectedIndex = filteredData.findIndex(item => item.id === firstSelectedId);
                            if (selectedIndex > -1) {
                                $options.scrollTop(selectedIndex * settings.itemHeight);
                            }
                        }
                    });
                }
            });
        });
    };

    // 添加全局配置方法
    $.customSelect = {
        setDefaults: function(options) {
            $.extend(DEFAULTS, options);
        }
    };
})(jQuery);
